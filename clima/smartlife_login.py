"""Login da conta Smart Life para o coletor do clima (roda 1×, pelo workflow
`clima-login.yml`). Dois passos, para o PNG do QR poder ser publicado como
artefato entre eles:

  python clima/smartlife_login.py qr        → gera o QR (log + qr.png + .qr_token)
  python clima/smartlife_login.py aguardar  → espera a confirmação no app e grava
                                              o token em climaSegredos/smartlife

Env: SMARTLIFE_USER_CODE (Smart Life → Eu → ⚙️ → Conta e segurança → Código de
usuário), FIREBASE_SERVICE_ACCOUNT (só no passo `aguardar`), TUYA_DEVICE_ID
(opcional: confere se a estação aparece na conta). Tokens nunca são impressos.
"""
import os
import sys
import time

from tuya_sharing.user import LoginControl

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import smartlife  # noqa: E402

ARQ_TOKEN = ".qr_token"
ESPERA_S = 8 * 60


def passo_qr(user_code):
    res = LoginControl().qr_code(smartlife.CLIENT_ID, smartlife.SCHEMA, user_code)
    if not res.get("success"):
        print(f"::error::Tuya recusou o código de usuário: {res.get('msg')} "
              f"(code {res.get('code')}). Confira o código no app.")
        return 1
    qr = res["result"]["qrcode"]
    with open(ARQ_TOKEN, "w") as f:
        f.write(qr)

    import qrcode
    q = qrcode.QRCode(border=4, box_size=12)
    q.add_data(f"tuyaSmart--qrLogin?token={qr}")
    q.make(fit=True)
    q.make_image().save("qr.png")
    print("Leia este QR com o app Smart Life (ícone de escanear, canto superior direito")
    print("da tela inicial) e toque em confirmar. Se o QR abaixo não ler, baixe o")
    print("artefato 'qr-login' (no resumo desta execução) e leia a imagem.\n")
    q.print_ascii(invert=True)
    return 0


def passo_aguardar(user_code):
    with open(ARQ_TOKEN) as f:
        qr = f.read().strip()
    lc = LoginControl()
    fim = time.time() + ESPERA_S
    print(f"Aguardando a confirmação no app (até {ESPERA_S // 60} min)…")
    while time.time() < fim:
        ok, info = lc.login_result(qr, smartlife.CLIENT_ID, user_code)
        if ok:
            break
        time.sleep(4)
    else:
        print("::error::Não houve confirmação no app a tempo. Rode o workflow de novo.")
        return 1

    from coletor import iniciar_firestore
    db = iniciar_firestore()
    smartlife.salvar_login(db, user_code, info)
    print(f"✅ Login salvo (servidor {info.get('endpoint')}). O coletor passa a usar o Smart Life.")

    device = os.environ.get("TUYA_DEVICE_ID")
    cli = smartlife.SmartLife(db, smartlife.carregar(db))
    try:
        aparelhos = cli.listar_dispositivos()
    except smartlife.SmartLifeErro as e:
        print(f"::warning::não consegui listar os aparelhos: {e}")
        return 0
    print("Aparelhos na conta:")
    for d in aparelhos:
        marca = "  ← estação do coletor" if d.get("id") == device else ""
        print(f"  {d.get('name')!s:30} {d.get('category')!s:6} "
              f"{'online' if d.get('online') else 'offline':7} {d.get('id')}{marca}")
    if device and not any(d.get("id") == device for d in aparelhos):
        print(f"::warning::A estação ({device}) não apareceu nesta conta. Faça o login "
              "com a conta Smart Life onde a estação está cadastrada.")
    return 0


def main():
    user_code = (os.environ.get("SMARTLIFE_USER_CODE") or "").strip()
    if not user_code:
        print("::error::informe o código de usuário do app Smart Life")
        return 1
    passo = sys.argv[1] if len(sys.argv) > 1 else ""
    if passo == "qr":
        return passo_qr(user_code)
    if passo == "aguardar":
        return passo_aguardar(user_code)
    print("uso: smartlife_login.py qr|aguardar")
    return 1


if __name__ == "__main__":
    sys.exit(main())
