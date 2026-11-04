# Views TV — piloto Android 0.1.0

Player nativo de TV corporativa e chamadas, usando a mesma base web da Rede8. APK comum: cada aparelho recebe a URL HTTPS da instalação do cliente. O painel web continua sendo a origem de serviços, chamadas, identidade, textos, voz e playlist. Não altera o layout do painel web nem seu banco.

## Instalar e usar

1. Copie `Views-TV-0.1.0-piloto.apk` para o aparelho e instale pelo gerenciador de arquivos. Se solicitado, autorize a instalação para esse gerenciador.
2. Abra **Views TV · Piloto**. Compatível com Android 8.0/API 26 ou superior, orientação horizontal; aparece também no launcher Android TV.
3. A URL da Rede8 já vem preenchida. Para outro cliente, informe sua URL inicial `https://…chatgpt.site`.
4. Toque em **Entrar e configurar aparelho**, entre com a conta ChatGPT autorizada na instalação e, depois de concluir o login, toque em **Concluir login e abrir TV**.
5. Aguarde o indicador de mídias locais. Configure os conteúdos em `/configuracoes` → Mídia indoor no computador. O aplicativo verifica a fila a cada 2 segundos e os downloads pendentes a cada 30 segundos.
6. Pressione **Voltar/Menu** ou toque em **Opções** para renovar o login, escolher e testar a voz instalada no Android ou mudar de cliente.

O login é feito em WebView sem ponte JavaScript para o código nativo. Provedores de identidade podem recusar login incorporado; isso precisa ser validado no aparelho. Não foi criado login por código, token compartilhado, nova conta, nem alterada a privacidade do Site. Se o provedor recusar, não instalar credenciais ou contornar essa restrição: a próxima etapa será uma integração de identidade suportada para o aparelho.

## O que este APK implementa

- Tela cheia e orientação horizontal; mantém a tela ligada enquanto o aplicativo está aberto.
- Busca somente dados de leitura. O aparelho não emite senhas, chama pacientes nem modifica a fila.
- Última senha, guichê, histórico e mensagem. Aplica nome, cores, texto, proporção/lado e enquadramento da mídia do painel.
- Voz nativa pt-BR, velocidade e volume do painel, frase de chamada/repetição e aviso sonoro. A escolha da voz é específica do aparelho; não reutiliza identificadores de vozes do navegador. Opções locais e dependentes de rede são identificadas no seletor.
- Download de mídias autenticado; nomes seguros, HTTPS, sem encaminhar cookies para outros servidores ou seguir redirecionamentos dos endpoints.
- Cada cliente tem sua pasta de cache separada. Até 30 conteúdos, 20 MB por arquivo, teto local de 640 MiB e reserva de espaço livre de 32 MiB. Downloads incompletos não viram arquivos reproduzíveis.
- Fotos com decodificação reduzida para Full HD, temporização de 5–300 segundos. Vídeos locais sem áudio, até o fim ou limite de 5 minutos. Erros de decodificação avançam ao próximo conteúdo.
- Após download, mídias continuam sem internet, inclusive reabrindo o aplicativo. As chamadas deixam de aparecer após 15 segundos sem atualização. Ao reconectar, atualiza a tela e não anuncia chamadas antigas acumuladas na desconexão.
- Saída da conta com confirmação local remove cookies e conteúdos do aparelho.

## Limites do piloto

Não validado em aparelho físico ou emulador. Os testes concluídos são compilação real do APK, assinatura e regras Java. Testar primeiro no PROSB-3000/16GB: instalação, login, voz pt-BR, vídeo H.264 Full HD, perda/retorno de rede e várias horas de reprodução. WebM e outros codecs dependem do sistema instalado. Uma voz identificada como dependente de rede não funciona offline.

Não há pareamento por código, execução automática após ligar, inicialização como launcher, modo quiosque administrado, atualizações remotas, impressão, agendamento ou publicação na Play Store. O APK usa o player nativo com disposição funcional inicial; revisão visual ficará para depois, conforme solicitado. Não é uma cópia visual exata do painel web.

Assinatura de desenvolvimento para o piloto. Preserve a chave de desenvolvimento em armazenamento privado para instalar futuras atualizações sem desinstalar. Não reutilize esta chave em produção; a distribuição comercial precisa de chave de lançamento própria. Ao trocar a chave, será necessário desinstalar o piloto antes de instalar a versão final.

## Compilar

Não há dependências externas no código Android. Java 17, Python 3 e SDK oficial (platform 36, Build Tools 36.0.0) são suficientes.

```sh
bash scripts/test.sh
python3 scripts/build-apk.py --sdk /caminho/Android/Sdk
```

O script executa AAPT2, javac, D8, zipalign e apksigner. Gera `build/Views-TV-0.1.0-piloto.apk` e verifica assinatura e manifesto. Caminhos alternativos podem ser passados em `--tools`, `--android-jar` e `--keystore`. A chave padrão é a de desenvolvimento em `~/.android/debug.keystore`, com as credenciais públicas convencionais de debug Android. Nunca adicione chaves ao Git. O build validado usa o script direto do SDK; não depende de Gradle nem baixa bibliotecas de terceiros.

Documentação oficial: https://developer.android.com/tools e https://developer.android.com/build/building-cmdline

## Validação concluída

- Regras Java executadas: URL de instalação e domínios de login, nomes de arquivos, limites de duração, chamadas desatualizadas e interpolação de voz.
- Fontes compiladas contra `android-36/android.jar`, com bytecode convertido para Android API 26.
- APK alinhado e verificado com esquemas de assinatura v2 e v3.
- Manifesto inspecionado: Android 8+, pacote `com.viewsmidia.player`, API alvo 36, launcher comum e Android TV, sem permissão de armazenamento externo, câmera ou microfone.
- Verificação física e login incorporado continuam pendentes; o APK não está certificado para operação comercial contínua.
