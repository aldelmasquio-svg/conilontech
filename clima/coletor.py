"""Coletor da estação meteorológica Tuya "Estação Km 18" → Firestore.

Roda no GitHub Actions (plano gratuito). A cada execução:
  1. lê o cursor em clima/estacao-km18/status/cursor;
  2. busca os report-logs da Tuya do cursor até agora (paginado) + 1 snapshot;
  3. monta a série de 1 minuto (carry-forward; máximo do minuto p/ rajada);
  4. grava os brutos, mescla os minutos nos docs de dia e recalcula o resumo
     (incl. ETo FAO-56) de cada dia tocado; só então avança o cursor.

Falha da Tuya (cota, trial expirado, auth, rede) → registra em status/ultimo
e sai com código 0, sem avançar o cursor. Secrets nunca são impressos.
"""
import base64
import hashlib
import hmac
import json
import math
import os
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from eto import altitude_pela_pressao, eto_diaria, fator_u2  # noqa: E402

# ---------------------------------------------------------------- config ----
ESTACAO_ID = "estacao-km18"
ESTACAO_NOME = "Estação Km 18"
LATITUDE = -18.7155016
LONGITUDE = -40.0182061
FUSO = ZoneInfo("America/Sao_Paulo")
ALTURA_ANEMOMETRO_M = 2.6
TUYA_ENDPOINT = "https://openapi.tuyaus.com"

JANELA_INICIAL_MS = 24 * 3600 * 1000     # sem cursor: começa 24 h atrás
JANELA_MAX_POR_EXECUCAO_MS = 24 * 3600 * 1000  # atrasado: recupera 24 h por vez
LAG_MS = 60 * 1000                       # não processa o último minuto (logs chegando)
COBERTURA_MS = 30 * 60 * 1000            # minuto coberto = algum reporte nos últimos 30 min
LIMIAR_COMPLETO = 0.90
PAGINA = 100
MAX_PAGINAS = 1000
BRUTO_DIAS = 90
BRUTO_LOGS_POR_DOC = 3000
HTTP_TIMEOUT = 30

CODES = [
    "temp_current_external", "humidity_outdoor", "dew_point_temp",
    "atmospheric_pressture", "windspeed_avg", "windspeed_gust", "Wind_speed",
    "Wing_direction", "Light_intensity", "uv_index", "sunlight_time",
    "rain_1h", "rain_24h", "rain_rate",
]
# A API de report-logs recusa estes códigos ("Parameter error", 40000303) e,
# na consulta conjunta, simplesmente os omite. Vêm só do snapshot (1 amostra
# por execução, ~5 min), tratado como evento no horário `time` da propriedade.
CODES_SO_SNAPSHOT = {"Wind_speed", "Wing_direction", "Light_intensity", "sunlight_time"}
CODES_LOG = [c for c in CODES if c not in CODES_SO_SNAPSHOT]
# Códigos cujo valor por minuto é o MÁXIMO do minuto (demais: último valor).
CODES_MAX = {"windspeed_gust", "Wind_speed"}

# Ordem fixa das colunas de cada ponto (string CSV) — gravada em `campos`.
CAMPOS = [
    ("t", "°C", 1), ("ur", "%", 0), ("orv", "°C", 1), ("p", "hPa", 1),
    ("u", "m/s", 2), ("raj", "m/s", 2), ("vel", "m/s", 2), ("dir", "°", 0),
    ("lux", "klux", 2), ("rad", "W/m²", 0), ("uv", "índice", 1),
    ("sol", "min", 0), ("c1h", "mm", 1), ("c24h", "mm", 1), ("ctx", "mm/h", 1),
]
IDX = {nome: i for i, (nome, _, _) in enumerate(CAMPOS)}


# ------------------------------------------------------------ conversões ----
def _num(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if math.isfinite(x) else None


_SETORES = {"N": 0, "NNE": 22.5, "NE": 45, "ENE": 67.5, "E": 90, "ESE": 112.5,
            "SE": 135, "SSE": 157.5, "S": 180, "SSW": 202.5, "SW": 225,
            "WSW": 247.5, "W": 270, "WNW": 292.5, "NW": 315, "NNW": 337.5}


def decodificar_direcao(v):
    """Wing_direction (raw base64, 9 bytes). Observado:
       "AABFAAAAYABw" → 00 00 45 00 | 00 | 00 60 | 00 70 → "E",   96°
       "AFNFAAAAjQHA" → 00 53 45 00 | 00 | 00 8d | 01 c0 → "SE",  141°
       "AFNTRQAAmwHA" → 00 53 53 45 | 00 | 00 9b | 01 c0 → "SSE", 155°
    Bytes 0-3 = nome do setor em ASCII (preenchido com 00); bytes 5-6
    (big-endian) = graus.
    Os graus só são aceitos se caírem no setor do nome (±45°); senão usa o
    centro do setor."""
    if isinstance(v, (int, float)):
        g = float(v)
        return g if 0 <= g <= 360 else None
    try:
        b = base64.b64decode(str(v), validate=False)
    except Exception:
        return None
    if len(b) < 7:
        return None
    nome = b[0:4].replace(b"\x00", b"").decode("ascii", "ignore").strip().upper()
    g = float(int.from_bytes(b[5:7], "big"))
    centro = _SETORES.get(nome)
    if centro is None:
        return g if 0 <= g <= 360 else None
    dif = abs((g - centro + 180) % 360 - 180)
    return g if 0 <= g <= 360 and dif <= 45 else float(centro)


def converter(code, raw):
    """Valor bruto da Tuya → dict {campo: valor convertido}."""
    if code == "Wing_direction":
        return {"dir": decodificar_direcao(raw)}
    x = _num(raw)
    if x is None:
        return {}
    if code == "temp_current_external":
        return {"t": x / 10}
    if code == "dew_point_temp":
        return {"orv": x / 10}
    if code == "humidity_outdoor":
        return {"ur": x}
    if code == "atmospheric_pressture":
        return {"p": x}
    if code == "windspeed_avg":
        return {"u": x / 10 / 3.6}
    if code == "windspeed_gust":
        return {"raj": x / 10 / 3.6}
    if code == "Wind_speed":
        return {"vel": x / 10 / 3.6}
    if code == "Light_intensity":
        klux = x / 100
        return {"lux": klux, "rad": klux * 7.9}
    if code == "uv_index":
        return {"uv": x}
    if code == "sunlight_time":
        return {"sol": x}
    if code == "rain_1h":
        return {"c1h": x / 10}
    if code == "rain_24h":
        return {"c24h": x / 10}
    if code == "rain_rate":
        return {"ctx": x / 10}
    return {}


def codificar_ponto(vals):
    out = []
    for (nome, _, dec), v in zip(CAMPOS, vals):
        if v is None:
            out.append("")
        else:
            s = f"{v:.{dec}f}"
            if "." in s:
                s = s.rstrip("0").rstrip(".")
            out.append("0" if s in ("-0", "") else s)
    return ",".join(out)


def decodificar_ponto(s):
    partes = s.split(",")
    partes += [""] * (len(CAMPOS) - len(partes))
    return [float(p) if p != "" else None for p in partes[: len(CAMPOS)]]


# ------------------------------------------------------------------ Tuya ----
class TuyaErro(Exception):
    def __init__(self, mensagem, codigo=None):
        super().__init__(mensagem)
        self.codigo = codigo


# Erros em que dividir os códigos em lotes não adianta (auth/token/cota/trial).
_ERROS_SEM_DIVISAO = {1004, 1010, 1011, 1012, 1013, 1100, 1106, 2008, 2009,
                      28841002, 28841004, 28841101, 28841105}


class Tuya:
    def __init__(self, access_id, access_secret):
        self.id = access_id
        self.secret = access_secret.encode()
        self.token = None
        self.chamadas = 0

    def _assinar(self, metodo, path, params, t, nonce, com_token):
        url = path
        if params:
            url += "?" + "&".join(f"{k}={params[k]}" for k in sorted(params))
        corpo_sha = hashlib.sha256(b"").hexdigest()
        str_to_sign = f"{metodo}\n{corpo_sha}\n\n{url}"
        base = self.id + (self.token if com_token else "") + t + nonce + str_to_sign
        return hmac.new(self.secret, base.encode(), hashlib.sha256).hexdigest().upper()

    def get(self, path, params=None, com_token=True):
        t = str(int(time.time() * 1000))
        nonce = uuid.uuid4().hex
        headers = {
            "client_id": self.id,
            "t": t,
            "nonce": nonce,
            "sign_method": "HMAC-SHA256",
            "sign": self._assinar("GET", path, params, t, nonce, com_token),
        }
        if com_token:
            headers["access_token"] = self.token
        self.chamadas += 1
        try:
            r = requests.get(TUYA_ENDPOINT + path, params=params, headers=headers,
                             timeout=HTTP_TIMEOUT)
        except requests.RequestException as e:
            raise TuyaErro(f"rede: {type(e).__name__}") from None
        if r.status_code != 200:
            raise TuyaErro(f"HTTP {r.status_code} em {path}")
        try:
            j = r.json()
        except ValueError:
            raise TuyaErro(f"resposta não-JSON em {path}") from None
        if not j.get("success"):
            codigo = j.get("code")
            try:
                codigo = int(codigo)
            except (TypeError, ValueError):
                pass
            raise TuyaErro(f"{path}: {j.get('msg')} (code {codigo})", codigo)
        return j.get("result")

    def autenticar(self):
        res = self.get("/v1.0/token", {"grant_type": 1}, com_token=False)
        self.token = (res or {}).get("access_token")
        if not self.token:
            raise TuyaErro("token vazio na resposta")

    def report_logs(self, device_id, codes, inicio_ms, fim_ms):
        """Todos os logs de `codes` em [inicio, fim]. Divide os códigos em lotes
        se a API recusar a lista inteira."""
        try:
            return self._report_logs_lote(device_id, codes, inicio_ms, fim_ms)
        except TuyaErro as e:
            if len(codes) <= 1 or e.codigo is None or e.codigo in _ERROS_SEM_DIVISAO:
                raise
            print(f"  report-logs recusou {len(codes)} códigos ({e}); dividindo em lotes")
            meio = len(codes) // 2
            return (self.report_logs(device_id, codes[:meio], inicio_ms, fim_ms)
                    + self.report_logs(device_id, codes[meio:], inicio_ms, fim_ms))

    def _report_logs_lote(self, device_id, codes, inicio_ms, fim_ms):
        path = f"/v2.0/cloud/thing/{device_id}/report-logs"
        logs, row_key = [], None
        for _ in range(MAX_PAGINAS):
            params = {"codes": ",".join(codes), "start_time": inicio_ms,
                      "end_time": fim_ms, "size": PAGINA}
            if row_key:
                params["last_row_key"] = row_key
            res = self.get(path, params) or {}
            logs.extend(res.get("logs") or [])
            row_key = res.get("last_row_key")
            if not res.get("has_more") or not row_key:
                return logs
        raise TuyaErro(f"report-logs: mais de {MAX_PAGINAS} páginas")

    def snapshot(self, device_id):
        res = self.get(f"/v2.0/cloud/thing/{device_id}/shadow/properties") or {}
        return res.get("properties") or []


def _ms(t):
    t = _num(t)
    if t is None:
        return None
    return int(t * 1000) if t < 1e12 else int(t)  # aceita segundos ou ms


# ----------------------------------------------------------- série 1 min ----
def montar_serie(logs, snapshot, estado, ultimo_reporte, inicio_ms, fim_ms):
    """Retorna (pontos {minuto_ms: [valores]}, estado, ultimo_reporte).

    estado: {code: {"t": ms, "v": raw}} — último valor conhecido antes de `inicio`.
    Um minuto só é gravado se a estação reportou QUALQUER código nos 30 min
    anteriores ao fim do minuto (vento calmo pode ficar horas sem reporte).
    """
    estado = {k: dict(v) for k, v in (estado or {}).items()}

    eventos = []
    for lg in logs:
        code, ts = lg.get("code"), _ms(lg.get("event_time"))
        if code in CODES and ts is not None and inicio_ms <= ts < fim_ms:
            eventos.append((ts, code, lg.get("value")))

    # Snapshot: propriedade com `time` < início vale para todo o intervalo
    # (não mudou desde então) → semeia o estado se for mais nova que ele.
    # Códigos só-snapshot com `time` dentro do intervalo (ou no último minuto,
    # ainda não processado — antecipado para fim−1 ms) viram evento.
    for p in snapshot:
        code, ts = p.get("code"), _ms(p.get("time"))
        if code not in CODES or ts is None:
            continue
        if ts < inicio_ms:
            if code not in estado or estado[code]["t"] < ts:
                estado[code] = {"t": ts, "v": p.get("value")}
            if ultimo_reporte is None or ts > ultimo_reporte:
                ultimo_reporte = ts
        elif code in CODES_SO_SNAPSHOT:
            eventos.append((min(ts, fim_ms - 1), code, p.get("value")))
    eventos.sort(key=lambda e: e[0])

    atual = [None] * len(CAMPOS)
    for code, e in estado.items():
        for campo, v in converter(code, e["v"]).items():
            atual[IDX[campo]] = v

    pontos, i = {}, 0
    for m in range(inicio_ms, fim_ms, 60_000):
        fim_min = m + 60_000
        maximos = {IDX[c]: atual[IDX[c]] for c in ("raj", "vel")}
        while i < len(eventos) and eventos[i][0] < fim_min:
            ts, code, v = eventos[i]
            i += 1
            estado[code] = {"t": ts, "v": v}
            ultimo_reporte = ts if ultimo_reporte is None else max(ultimo_reporte, ts)
            for campo, x in converter(code, v).items():
                atual[IDX[campo]] = x
                if code in CODES_MAX and x is not None:
                    j = IDX[campo]
                    maximos[j] = x if maximos[j] is None else max(maximos[j], x)
        if ultimo_reporte is not None and fim_min - ultimo_reporte <= COBERTURA_MS:
            vals = list(atual)
            for j, x in maximos.items():
                vals[j] = x
            pontos[m] = vals
    return pontos, estado, ultimo_reporte


# ---------------------------------------------------------------- resumo ----
def resumir(dia, pontos):
    """pontos: {"HH:MM": [valores]} de um dia local → dict de resumo."""
    col = lambda nome: [(k, v[IDX[nome]]) for k, v in pontos.items()  # noqa: E731
                        if v[IDX[nome]] is not None]
    vals = lambda nome: [v for _, v in col(nome)]  # noqa: E731
    media = lambda xs: sum(xs) / len(xs) if xs else None  # noqa: E731
    r2 = lambda x, n=2: None if x is None else round(x, n)  # noqa: E731

    t, ur, u, p = vals("t"), vals("ur"), vals("u"), vals("p")
    fu2 = fator_u2(ALTURA_ANEMOMETRO_M)
    raj = col("raj")
    raj_max = max(raj, key=lambda kv: kv[1]) if raj else None
    rad = vals("rad")
    rs = sum(rad) * 60 / 1e6 if rad else None  # W/m² × 60 s por minuto → MJ/m²
    cobertos = len(pontos)

    res = {
        "Tmax": r2(max(t) if t else None, 1), "Tmin": r2(min(t) if t else None, 1),
        "Tmed": r2(media(t), 1),
        "URmax": r2(max(ur) if ur else None, 0), "URmin": r2(min(ur) if ur else None, 0),
        "u2med": r2(media([x * fu2 for x in u])),
        "rajadaMax": r2(raj_max[1]) if raj_max else None,
        "rajadaMaxKmh": r2(raj_max[1] * 3.6, 1) if raj_max else None,
        "rajadaHora": raj_max[0] if raj_max else None,
        "RsMJ": r2(rs),
        "chuvaMm": r2(max(vals("c24h")) if vals("c24h") else None, 1),
        "insolacaoMin": r2(max(vals("sol")) if vals("sol") else None, 0),
        "Pmed": r2(media(p), 1),
        "minutosCobertos": cobertos,
        "coberturaPct": round(cobertos / 1440 * 100, 1),
        "completo": cobertos / 1440 >= LIMIAR_COMPLETO,
        "altitudeEstimadaM": None,
        "ETo": None,
        "calculadoEm": datetime.now(timezone.utc),
    }
    if res["Pmed"] is not None:
        res["altitudeEstimadaM"] = round(altitude_pela_pressao(res["Pmed"] / 10))
    if None not in (res["Tmax"], res["Tmin"], res["URmax"], res["URmin"],
                    res["u2med"], rs, res["Pmed"]):
        dia_ano = datetime.strptime(dia, "%Y-%m-%d").timetuple().tm_yday
        e = eto_diaria(max(t), min(t), max(ur), min(ur), media([x * fu2 for x in u]),
                       rs, res["Pmed"] / 10, LATITUDE, dia_ano,
                       max(res["altitudeEstimadaM"], 0))
        res["ETo"] = round(e["ETo"], 2)
    return res


# ------------------------------------------------------------- Firestore ----
def iniciar_firestore():
    import firebase_admin
    from firebase_admin import credentials, firestore
    info = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
    firebase_admin.initialize_app(credentials.Certificate(info))
    return firestore.client()


def registrar_falha(base, mensagem):
    ref = base.collection("status").document("ultimo")
    ant = ref.get()
    falhas = ((ant.to_dict() or {}).get("falhasSeguidas", 0) if ant.exists else 0) + 1
    ref.set({"ok": False, "mensagem": mensagem, "data": datetime.now(timezone.utc),
             "falhasSeguidas": falhas})
    print(f"::warning::Tuya falhou ({falhas}ª seguida): {mensagem}")


def gravar_bruto(base, agora, inicio_ms, fim_ms, logs, snapshot):
    iso = agora.strftime("%Y-%m-%dT%H:%M:%SZ")
    compactos = [{"c": lg.get("code"), "t": _ms(lg.get("event_time")), "v": lg.get("value")}
                 for lg in logs]
    partes = [compactos[i:i + BRUTO_LOGS_POR_DOC]
              for i in range(0, len(compactos), BRUTO_LOGS_POR_DOC)] or [[]]
    for n, parte in enumerate(partes, 1):
        doc_id = iso if n == 1 else f"{iso}_p{n}"
        dados = {"criadoEm": agora, "inicio": inicio_ms, "fim": fim_ms,
                 "parte": n, "partes": len(partes), "logs": parte}
        if n == 1:
            dados["snapshot"] = [{"c": p.get("code"), "t": _ms(p.get("time")),
                                  "v": p.get("value")} for p in snapshot]
        base.collection("bruto").document(doc_id).set(dados)


def limpar_bruto(db, base, agora):
    from google.cloud.firestore_v1.base_query import FieldFilter
    corte = agora - timedelta(days=BRUTO_DIAS)
    apagados = 0
    for _ in range(50):
        consulta = base.collection("bruto").where(filter=FieldFilter("criadoEm", "<", corte))
        docs = list(consulta.limit(400).stream())
        if not docs:
            break
        lote = db.batch()
        for d in docs:
            lote.delete(d.reference)
        lote.commit()
        apagados += len(docs)
    return apagados



# ----------------------------------------------------------- diagnóstico ----
def diagnostico(horas):
    """Só leitura (não usa Firestore): mostra o que a Tuya devolve."""
    tuya = Tuya(os.environ["TUYA_ACCESS_ID"], os.environ["TUYA_ACCESS_SECRET"])
    device = os.environ["TUYA_DEVICE_ID"]
    fmt = lambda ms: datetime.fromtimestamp(ms / 1000, FUSO).strftime("%d/%m %H:%M:%S")  # noqa: E731
    fim = int(time.time() * 1000)
    ini = fim - horas * 3600 * 1000
    tuya.autenticar()
    print(f"== janela {fmt(ini)} → {fmt(fim)}")

    for path_m in (f"/v2.0/cloud/thing/{device}/model",
                   f"/v1.0/iot-03/devices/{device}/specification"):
        print(f"== {path_m.replace(device, '<id>')}")
        try:
            res = tuya.get(path_m) or {}
        except TuyaErro as e:
            print(f"  ERRO {e}")
            continue
        txt = res.get("model") if isinstance(res, dict) else None
        if isinstance(txt, str):
            try:
                res = json.loads(txt)
            except ValueError:
                pass
        props = []
        for sv in (res.get("services") or []) if isinstance(res, dict) else []:
            props += sv.get("properties") or []
        if props:
            for p in props:
                if p.get("code") in CODES:
                    print(f"  {p.get('code'):24} {json.dumps(p.get('typeSpec'), ensure_ascii=False)[:200]}")
        else:
            for item in (res.get("status") or []) + (res.get("functions") or []):
                if item.get("code") in CODES:
                    print(f"  {item.get('code'):24} {item.get('type')} {str(item.get('values'))[:200]}")

    print("== snapshot (code | time | value)")
    for p in sorted(tuya.snapshot(device), key=lambda p: str(p.get("code"))):
        ts = _ms(p.get("time"))
        print(f"  {p.get('code')!s:28} | {fmt(ts) if ts else '-':15} | {str(p.get('value'))[:40]}"
              f"{'' if p.get('code') in CODES else '   (fora da lista)'}")

    print("== todos os códigos juntos, página a página")
    path = f"/v2.0/cloud/thing/{device}/report-logs"
    row_key, total = None, 0
    for pg in range(1, 40):
        params = {"codes": ",".join(CODES), "start_time": ini, "end_time": fim, "size": PAGINA}
        if row_key:
            params["last_row_key"] = row_key
        res = tuya.get(path, params) or {}
        lg = res.get("logs") or []
        total += len(lg)
        ts = [_ms(x.get("event_time")) for x in lg]
        print(f"  pág {pg}: {len(lg)} logs, {fmt(ts[0]) if ts else '-'} … {fmt(ts[-1]) if ts else '-'}, "
              f"has_more={res.get('has_more')}, chaves={sorted(k for k in res if k != 'logs')}")
        row_key = res.get("last_row_key")
        if not res.get("has_more") or not row_key:
            break
    print(f"  total {total}")

    print("== um código por vez (1ª página)")
    for code in CODES:
        try:
            res = tuya.get(path, {"codes": code, "start_time": ini, "end_time": fim,
                                  "size": PAGINA}) or {}
        except TuyaErro as e:
            print(f"  {code:24} ERRO {e}")
            continue
        lg = res.get("logs") or []
        ts = sorted(_ms(x.get("event_time")) for x in lg)
        ex = ", ".join(str(x.get("value"))[:16] for x in lg[:3])
        print(f"  {code:24} {len(lg):3} logs, {fmt(ts[0]) if ts else '-'} … "
              f"{fmt(ts[-1]) if ts else '-'}, has_more={res.get('has_more')}, ex: {ex}")
    print(f"== {tuya.chamadas} chamadas")
    return 0

# ------------------------------------------------------------------ main ----
def main():
    for nome in ("TUYA_ACCESS_ID", "TUYA_ACCESS_SECRET", "TUYA_DEVICE_ID",
                 "FIREBASE_SERVICE_ACCOUNT"):
        if not os.environ.get(nome):
            print(f"::error::variável {nome} ausente")
            return 1
    if os.environ.get("DIAGNOSTICO") == "true":
        return diagnostico(int(os.environ.get("DIAGNOSTICO_HORAS") or 24))

    db = iniciar_firestore()
    base = db.collection("clima").document(ESTACAO_ID)
    agora = datetime.now(timezone.utc).replace(microsecond=0)
    agora_ms = int(agora.timestamp() * 1000)

    cur_ref = base.collection("status").document("cursor")
    cur_snap = cur_ref.get()
    cur = cur_snap.to_dict() if cur_snap.exists else {}
    inicio_ms = cur.get("ate")
    if inicio_ms is None:
        inicio_ms = (agora_ms - JANELA_INICIAL_MS) // 60_000 * 60_000
        print("Sem cursor: começando 24 h atrás")
    fim_ms = (agora_ms - LAG_MS) // 60_000 * 60_000
    fim_ms = min(fim_ms, inicio_ms + JANELA_MAX_POR_EXECUCAO_MS)
    if fim_ms <= inicio_ms:
        print("Nada a processar ainda (intervalo < 1 min)")
        return 0
    fmt = lambda ms: datetime.fromtimestamp(ms / 1000, FUSO).strftime("%d/%m %H:%M")  # noqa: E731
    print(f"Intervalo: {fmt(inicio_ms)} → {fmt(fim_ms)} ({(fim_ms - inicio_ms) // 60000} min)")

    # ---- Tuya
    tuya = Tuya(os.environ["TUYA_ACCESS_ID"], os.environ["TUYA_ACCESS_SECRET"])
    device = os.environ["TUYA_DEVICE_ID"]
    aviso = None
    try:
        tuya.autenticar()
        logs = tuya.report_logs(device, CODES_LOG, inicio_ms, fim_ms)
        try:
            snapshot = tuya.snapshot(device)
        except TuyaErro as e:
            snapshot, aviso = [], f"snapshot falhou: {e}"
            print(f"::warning::{aviso}")
    except TuyaErro as e:
        registrar_falha(base, str(e))
        return 0
    print(f"Tuya: {len(logs)} logs, {len(snapshot)} propriedades no snapshot, "
          f"{tuya.chamadas} chamadas")

    # ---- série por minuto
    pontos, estado, ultimo_rep = montar_serie(
        logs, snapshot, cur.get("estado"), cur.get("ultimoReporte"), inicio_ms, fim_ms)

    por_dia = {}
    for m, vals in pontos.items():
        dt = datetime.fromtimestamp(m / 1000, FUSO)
        por_dia.setdefault(dt.strftime("%Y-%m-%d"), {})[dt.strftime("%H:%M")] = vals
    # Dias tocados pelo intervalo (mesmo sem pontos, p/ recalcular o resumo).
    dias = set(por_dia)
    d = datetime.fromtimestamp(inicio_ms / 1000, FUSO).date()
    while d <= datetime.fromtimestamp((fim_ms - 1) / 1000, FUSO).date():
        dias.add(d.isoformat())
        d += timedelta(days=1)

    # ---- gravação (bruto → dias → cursor → status)
    gravar_bruto(base, agora, inicio_ms, fim_ms, logs, snapshot)
    base.set({"nome": ESTACAO_NOME, "lat": LATITUDE, "lng": LONGITUDE,
              "fuso": str(FUSO.key), "campos": [c[0] for c in CAMPOS]}, merge=True)

    resumo_log = []
    for dia in sorted(dias):
        ref = base.collection("dias").document(dia)
        snap = ref.get()
        ant = (snap.to_dict() or {}).get("pontos", {}) if snap.exists else {}
        mesclado = {k: decodificar_ponto(v) for k, v in ant.items()}
        mesclado.update(por_dia.get(dia, {}))
        if not mesclado:
            continue
        mesclado = dict(sorted(mesclado.items()))
        res = resumir(dia, mesclado)
        ref.set({
            "data": dia,
            "campos": [{"nome": n, "unidade": u} for n, u, _ in CAMPOS],
            "pontos": {k: codificar_ponto(v) for k, v in mesclado.items()},
            "resumo": res,
        })
        # Cópia leve só do resumo, p/ a página listar o histórico sem baixar
        # os ~100 KB de pontos de cada dia.
        base.collection("resumos").document(dia).set({"data": dia, **res})
        resumo_log.append(f"{dia}: {res['minutosCobertos']} min ({res['coberturaPct']}%), "
                          f"T {res['Tmin']}–{res['Tmax']} °C, UR {res['URmin']}–{res['URmax']} %, "
                          f"P {res['Pmed']} hPa, Rs {res['RsMJ']} MJ, ETo {res['ETo']} mm")

    ultimo_ev = max((_ms(lg.get("event_time")) or 0 for lg in logs), default=None)
    cur_ref.set({
        "ate": fim_ms,
        "ultimoEventTime": max(ultimo_ev or 0, cur.get("ultimoEventTime") or 0) or None,
        "ultimoReporte": ultimo_rep,
        "estado": estado,
        "atualizadoEm": agora,
    })
    base.collection("status").document("ultimo").set({
        "ok": True,
        "mensagem": aviso or "ok",
        "data": agora,
        "falhasSeguidas": 0,
        "logsRecebidos": len(logs),
        "minutosGravados": len(pontos),
        "diasTocados": sorted(dias),
        "chamadasTuya": tuya.chamadas,
    })
    for linha in resumo_log:
        print("  " + linha)

    try:
        n = limpar_bruto(db, base, agora)
        if n:
            print(f"Bruto: {n} docs com mais de {BRUTO_DIAS} dias apagados")
    except Exception as e:  # limpeza nunca derruba a coleta
        print(f"::warning::limpeza do bruto falhou: {type(e).__name__}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
