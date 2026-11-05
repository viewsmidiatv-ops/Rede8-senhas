# Views TV — piloto Android 0.2.1

Player de chamadas e mídia indoor com ativação por QR code/código, sem WebView de login. A integração remota usa o projeto Rede8 Senhas no Supabase e o painel administrativo existente. A versão 0.2.1 substitui o login incorporado da 0.1.0 por autorização do aparelho; a validação física de voz, codec e reprodução contínua continua necessária.

## Instalar e ativar

1. Instale o APK 0.2.1 no Android 8+ (API 26), com a mesma assinatura de desenvolvimento do piloto anterior.
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

O script executa AAPT2, javac, D8, zipalign e apksigner. Saída `build/Views-TV-0.2.1-piloto.apk`. Os testes verificam URLs, nomes seguros, limites, tempo de desconexão, textos e geração/decodificação do QR code. Compilação real e assinatura v2/v3 aprovadas. Validação física e pareamento remoto ainda pendentes.

Use a chave privada de desenvolvimento preservada do piloto para atualizar uma instalação existente. Nunca adicione chaves ao Git ou use esta chave de desenvolvimento para distribuição comercial. O build utiliza por padrão `~/.android/debug.keystore`; caminhos alternativos disponíveis em `--keystore`, `--tools` e `--android-jar`.

Não há inicialização automática após ligar, gerenciamento de quiosque, atualização remota, impressão ou publicação na Play Store. Revisão de layout fica para depois, conforme solicitado.

## Referências

- SDK/assinatura: https://developer.android.com/tools
- ZXing: https://github.com/zxing/zxing — Apache License 2.0
- Contrato de pareamento e configuração remota: `online/docs/SUPABASE-APARELHOS.md` no repositório principal.

## Correção de voz em 0.2.1

O manifesto declara a consulta ao serviço `android.intent.action.TTS_SERVICE`, necessária para detectar mecanismos em Android 11+ quando o app mira API recente. A inicialização é assíncrona, ignora respostas de instâncias antigas e diferencia mecanismo ausente, falha de conexão e ausência de dados de português. Uma lista de vozes vazia não é tratada como ausência de mecanismo quando a síntese padrão funciona.

Em Opções → Mecanismo e ajuda de voz, o usuário pode selecionar o mecanismo instalado, verificar/instalar dados de voz, abrir as configurações Android e reconectar. Ao voltar das configurações o mecanismo é reinicializado. O teste usa a voz escolhida, velocidade e volume configurados. O aplicativo não instala um mecanismo por conta própria: se o aparelho não tiver um mecanismo compatível, é necessário instalar ou habilitar um no Android.

Validação: regras Java incluindo estados de voz, QR roundtrip, compilação, manifesto binário e assinatura. A reprodução física precisa ser testada no aparelho. Vozes disponíveis no navegador do computador não são automaticamente transferidas ao Android; uma voz padronizada online requer integração específica e não foi adicionada nesta correção.

Referência oficial: https://developer.android.com/about/versions/11/behavior-changes-11#tts
