# Views TV — piloto Android 0.2.0

Player de chamadas e mídia indoor com ativação por QR code/código, sem WebView de login. Esta versão está compilada e validada localmente, mas ainda não liberada para operação: o servidor Supabase aguarda aplicação e validação da migração. O APK 0.1.0 permanece a versão anteriormente entregue.

## Após a integração do servidor

1. Instale o APK 0.2.0 no Android 8+ (API 26), com a mesma assinatura de desenvolvimento do piloto anterior.
2. Abra Views TV e informe o nome do aparelho. A conexão da Rede8 já está preenchida. Para outro cliente, configure a URL do painel e a URL Supabase de conexão mostrada na aba Aparelhos.
3. Selecione Gerar QR code e código de ativação.
4. No celular ou computador, abra o QR code. Entre no painel com sua conta autorizada, confira o código e aprove o aparelho. Alternativamente, abra `/aparelhos` e digite o código.
5. A TV abre o player automaticamente. Em Aparelhos, sincronize os conteúdos existentes para que o aplicativo possa baixá-los do armazenamento privado.

Códigos expiram em dez minutos e só podem ser usados uma vez. O administrador pode revogar a autorização; conteúdos já baixados podem continuar localmente. O aplicativo não emite nem chama senhas e não tem acesso administrativo. As chamadas precisam de conexão. O APK não contém chaves de serviço Supabase nem credenciais ChatGPT.

## Funcionamento

Tela cheia horizontal, voz nativa pt-BR (escolha local nas opções), frases/velocidade/volume do painel, chamadas, histórico, lado/proporção e reprodução de mídias sem áudio. O segredo de autorização é cifrado com chave não exportável do Android Keystore. Requisições usam HTTPS sem seguir redirecionamentos e com credencial restrita ao servidor configurado.

Fotos são reduzidas para Full HD na decodificação; vídeos locais ficam sempre mudos. A reprodução segue a playlist, com teto de cinco minutos por vídeo. Até 30 conteúdos e 20 MiB por arquivo; cache máximo de 640 MiB. Após 15 segundos sem atualização, chamadas ficam ocultas. Ao reconectar não são anunciadas chamadas antigas.

## Compilar e testar

Java 17, Python 3, SDK platform 36 e Build Tools 36.0.0. O build baixa ZXing Core 3.5.3 do Maven Central e verifica SHA-256 fixo antes de compilar. Esta biblioteca é usada somente para gerar QR code localmente. Não usa um serviço externo de geração de QR.

```sh
python3 scripts/build-apk.py --sdk /caminho/Android/Sdk
bash scripts/test.sh
```

O script executa AAPT2, javac, D8, zipalign e apksigner. Saída `build/Views-TV-0.2.0-piloto.apk`. Os testes verificam URLs, nomes seguros, limites, tempo de desconexão, textos e geração/decodificação do QR code. Compilação real e assinatura v2/v3 aprovadas. Validação física e pareamento remoto ainda pendentes.

Use a chave privada de desenvolvimento preservada do piloto para atualizar uma instalação existente. Nunca adicione chaves ao Git ou use esta chave de desenvolvimento para distribuição comercial. O build utiliza por padrão `~/.android/debug.keystore`; caminhos alternativos disponíveis em `--keystore`, `--tools` e `--android-jar`.

Não há inicialização automática após ligar, gerenciamento de quiosque, atualização remota, impressão ou publicação na Play Store. Revisão de layout fica para depois, conforme solicitado.

## Referências

- SDK/assinatura: https://developer.android.com/tools
- ZXing: https://github.com/zxing/zxing — Apache License 2.0
- Contrato de pareamento e configuração remota: `online/docs/SUPABASE-APARELHOS.md` no repositório principal.
