# Ativação das TVs por código — preparada, aguardando aplicação no Supabase

Projeto autorizado: Rede8 Senhas, referência `vhsihfbhxqrxtkyfyebr`, região `sa-east-1`.

## Estado desta entrega

Código implementado e verificado localmente. As duas tentativas de `apply_migration` retornaram confirmação expirada; consulta posterior confirmou zero tabelas no schema public. Portanto a migração não foi aplicada, a Edge Function não foi publicada e as variáveis de integração não foram configuradas. A publicação web mantém o armazenamento anterior enquanto essas variáveis estiverem ausentes. O formulário de aparelhos informa que falta configurar a integração.

Arquivo SQL completo: `supabase/migrations/20261105003047_device_pairing.sql`. Pode ser revisado e aplicado no SQL Editor do projeto correto, ou pela confirmação do conector. Ele cria somente estruturas novas e o bucket privado; inclui revogação da execução pública da função existente `rls_auto_enable()`, identificada nos avisos do projeto. A revogação não desativa o gatilho executado pelo proprietário do banco.

Depois da aplicação, verificar as tabelas e os advisors antes de continuar. Não reaplicar uma migração já aplicada. O nome da migração remota e a versão local devem ser reconciliados ao retomar; não alterar SQL já aplicado.

## Fluxo do aparelho

O APK 0.2.0 recebe uma URL de conexão Supabase e gera um QR code com código humano de oito caracteres. O administrador acessa `/aparelhos`, confere a solicitação e confirma o mesmo código da TV. O aplicativo passa a consultar as chamadas e baixar as mídias diretamente da função Supabase, sem login incorporado ou cookies do ChatGPT.

A autorização do aparelho é um segredo aleatório de 256 bits, cifrado no Android Keystore. O banco armazena apenas seu SHA-256. Códigos duram dez minutos, uso único; credenciais aprovadas duram até 90 dias e podem ser revogadas. Há limites de solicitações por origem e por instalação. O endpoint inicial é público por necessidade do pareamento; todos os demais acessos exigem credencial de aparelho ou de servidor. `verify_jwt=false` é necessário porque a função verifica suas próprias credenciais; nenhuma chave de serviço é distribuída ao APK.

## Integração do servidor

A função `supabase/functions/tv-device/index.ts` lê a chave secreta somente do ambiente padrão do Supabase. O módulo handler usa os serviços REST/Storage internos, com credenciais de servidor. Tabelas têm RLS sem política para clientes e privilégios restritos a service_role; RPCs são SECURITY INVOKER e com EXECUTE restrito a service_role. O painel continua com autenticação ChatGPT e seus perfis verificados no D1. O APK é somente leitura.

Ainda a fazer após a confirmação SQL:

1. Gerar uma chave aleatória de integração de 32 bytes, sem imprimi-la nem gravá-la em código. Guardar seu SHA-256 em tv_instances com id `rede8` e verification_url `https://rede8-senhas-piloto.grupo-ortocd-0618.chatgpt.site/aparelhos`.
2. Publicar a função `tv-device`, com autenticação própria e as verificações implementadas.
3. Configurar as variáveis secretas do Site `TV_BRIDGE_KEY` e a URL `TV_DEVICE_URL` via ferramenta de ambiente. A chave bruta fica somente no servidor Site, nunca no navegador ou APK.
4. Publicar o mesmo código. O primeiro acesso ao painel copia a fila existente D1 para Supabase preservando revisão, senhas e configurações. A operação seed é idempotente e nunca sobrescreve fila remota existente. Em seguida, a fila usa leitura e compare-and-swap no Supabase. Erros remotos não fazem fallback para uma segunda fila D1.
5. Em Aparelhos, sincronizar arquivos de mídia do R2 para o bucket privado tv-media, por arquivo. O procedimento é idempotente e mantém a origem. Novos arquivos adicionados à playlist precisam de sincronização antes do download pelo APK. Não migra nem apaga os arquivos R2.
6. Fazer teste real de geração, expiração, aprovação, leitura, cópia de mídia, isolamento e revogação; consultar advisors e corrigir avisos. Só então entregar o novo APK para uso.

Caminho futuro: substituir também a autenticação administrativa e os vínculos de usuários por Supabase Auth, após definir os administradores. Essa mudança não faz parte desta etapa e não pode redefinir o proprietário usando o primeiro visitante de um endpoint público.

## Testes concluídos

- 25 testes de regras existentes.
- Integração real D1/Miniflare e R2, sem regressões.
- 7 testes do handler: projeção pública, autenticação, hash de credenciais, escopo de instalação, mídia fora da playlist e expiração.
- Migração executada em Postgres embarcado PGlite: tabelas, RLS, uso único, revogação, seed idempotente, revisão atômica, limites e bloqueio dos papéis anon/authenticated.
- TypeScript e build web.
- Regras Java, QR code gerado e decodificado por ZXing, compilação do APK Android, alinhamento e assinatura v2/v3.

Comandos: `node --test tests/device-handler.test.mjs`; para o teste SQL, instale `@electric-sql/pglite@0.3.14` em ambiente de testes e execute `PGLITE_MODULE=/caminho/node_modules/@electric-sql/pglite/dist/index.js node tests/device-schema.test.mjs`.

Sem verificação ponta a ponta no Supabase remoto e sem teste físico. O preview visual também não foi validado neste fluxo, devido à autenticação da hospedagem e à indisponibilidade anterior do preview.
