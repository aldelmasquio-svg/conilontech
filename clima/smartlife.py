"""Acesso à estação pela conta do app Smart Life (sem Tuya IoT Core).

Usa o SDK oficial `tuya-device-sharing-sdk`, o mesmo da integração Tuya do
Home Assistant: login 1× por QR code lido no app (smartlife_login.py), depois
access/refresh token renovados sozinhos. Não depende de trial/renovação da
plataforma IoT. Limite: só o estado atual (snapshot), sem histórico de logs.

O token fica em `climaSegredos/smartlife` (regras: ninguém lê pelo app; só o
Admin SDK). Nunca imprima o conteúdo desse doc.
"""
from datetime import datetime, timezone

from tuya_sharing.customerapi import CustomerApi, CustomerTokenInfo, SharingTokenListener
from tuya_sharing.exceptions import ApiRequestException

# Mesmos valores da integração do Home Assistant (homeassistant/components/tuya/const.py):
# o endpoint de login por QR só aceita este client.
CLIENT_ID = "HA_3y9q4ak7g4ephrvke"
SCHEMA = "haauthorize"
COLECAO = "climaSegredos"
DOC = "smartlife"


class SmartLifeErro(Exception):
    pass


def ref_token(db):
    return db.collection(COLECAO).document(DOC)


def carregar(db):
    """Dados do login salvos, ou None se nunca foi feito."""
    snap = ref_token(db).get()
    return snap.to_dict() if snap.exists else None


def salvar_login(db, user_code, info):
    """`info` = resultado de LoginControl.login_result (ok)."""
    ref_token(db).set({
        "userCode": user_code,
        "terminalId": info["terminal_id"],
        "endpoint": info["endpoint"],
        "tokenInfo": {k: info[k] for k in
                      ("t", "uid", "expire_time", "access_token", "refresh_token")},
        "criadoEm": datetime.now(timezone.utc),
        "atualizadoEm": datetime.now(timezone.utc),
    })


class _Ouvinte(SharingTokenListener):
    """O SDK troca o refresh token a cada renovação: grava o novo na hora,
    senão a próxima execução fica com um token já invalidado."""

    def __init__(self, db):
        self.db = db
        self.renovou = False

    def update_token(self, token_info):
        ref_token(self.db).update({"tokenInfo": dict(token_info),
                                   "atualizadoEm": datetime.now(timezone.utc)})
        self.renovou = True


class SmartLife:
    def __init__(self, db, dados):
        self.ouvinte = _Ouvinte(db)
        self.api = CustomerApi(CustomerTokenInfo(dados["tokenInfo"]), CLIENT_ID,
                               dados["userCode"], dados["endpoint"], self.ouvinte)
        self.chamadas = 0

    def get(self, path, params=None):
        self.chamadas += 1
        try:
            res = self.api.get(path, params)
        except ApiRequestException as e:
            raise SmartLifeErro(f"{path}: {e.error_message} (code {e.error_code})") from None
        except Exception as e:  # rede, JSON, decriptação
            raise SmartLifeErro(f"{path}: {type(e).__name__}") from None
        if res is None:  # o SDK devolve None em HTTP != 2xx
            raise SmartLifeErro(f"{path}: HTTP com erro")
        return res.get("result")

    def dispositivo(self, device_id):
        """Detalhe do aparelho (dict com status [{code, value}], online, ...)."""
        res = self.get("/v1.0/m/life/ha/devices/detail", {"devIds": device_id}) or []
        for d in res:
            if d.get("id") == device_id:
                return d
        raise SmartLifeErro(f"aparelho {device_id} não está nesta conta Smart Life")

    def listar_dispositivos(self):
        out = []
        for casa in self.get("/v1.0/m/life/users/homes") or []:
            hid = str(casa.get("ownerId"))
            for d in self.get("/v1.0/m/life/ha/home/devices", {"homeId": hid}) or []:
                out.append(d)
        return out

    def especificacao(self, device_id):
        return self.get(f"/v1.1/m/life/{device_id}/specifications") or {}

    def snapshot(self, device_id, agora_ms):
        """Estado atual no formato do snapshot da IoT ({code, value, time}).
        A API não informa a hora de cada valor: usa `agora_ms`. Aparelho
        offline → lista vazia (o valor na nuvem estaria parado)."""
        d = self.dispositivo(device_id)
        if not d.get("online", True):
            return [], d
        props = [{"code": s["code"], "value": s.get("value"), "time": agora_ms}
                 for s in d.get("status") or [] if "code" in s]
        return props, d
