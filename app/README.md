# App nativo (Android, e iOS no futuro)

Casca [Capacitor](https://capacitorjs.com) que abre o site publicado
(`https://aldelmasquio-svg.github.io/conilontech/`) dentro de um app. O conteúdo continua vindo
do site: toda mudança nas páginas vale no app na hora, sem gerar APK novo. Só é preciso gerar de
novo quando mudar algo desta pasta (ícone, permissões, versão do Capacitor).

## Android
- O workflow `.github/workflows/app-android.yml` compila o APK a cada push que mexe em `app/`
  (ou manualmente: Actions → "App Android (APK)" → Run workflow).
- Na `main`, o APK vai para o release **app-android**, com link fixo:
  `https://github.com/aldelmasquio-svg/conilontech/releases/download/app-android/conilon-tech.apk`
- Instalar: abrir o link no celular → baixar → abrir o arquivo → permitir "instalar apps
  desconhecidos" para o navegador/WhatsApp quando o Android pedir.
- Permissões declaradas: internet, localização (GPS das Avaliações/Amostragem/Mapa) e câmera.

### Chave de assinatura definitiva
Sem chave própria, cada build sai com uma chave de teste diferente e a versão nova **não instala
por cima** (é preciso desinstalar a antiga). Para fixar a chave, crie dois *secrets* no GitHub
(Settings → Secrets and variables → Actions):
- `ANDROID_KEYSTORE_BASE64`: o arquivo `.jks` em base64 (`base64 -w0 conilon.jks`)
- `ANDROID_KEYSTORE_PASSWORD`: a senha do arquivo (alias da chave: `conilon`)

Guarde o `.jks` e a senha em lugar seguro: sem eles não dá para publicar atualizações do mesmo app.

### Google Play (quando quiser)
Conta de desenvolvedor (US$ 25 uma vez) e gerar `bundleRelease` (`.aab`) em vez de `assembleRelease`.

## iOS
Ainda não gerado: precisa da conta Apple Developer (US$ 99/ano). Quando for a hora,
`npm i @capacitor/ios && npx cap add ios` aqui e compilar num serviço em nuvem com macOS
(Codemagic/Ionic Appflow/GitHub Actions `macos-latest`). Até lá, no iPhone o app é instalado pelo
Safari → Compartilhar → Adicionar à Tela de Início (o menu do site mostra o passo a passo).
