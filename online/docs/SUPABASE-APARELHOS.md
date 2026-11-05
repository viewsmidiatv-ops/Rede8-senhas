# Ativação das TVs por código — preparada, aguardando aplicação no Supabase

Projeto autorizado: Rede8 Senhas, referência `vhsihfbhxqrxtkyfyebr`, região `sa-east-1`.

## Configuração remota

As tabelas e funções SQL foram aplicadas pelo administrador no SQL Editor. A migração local é `supabase/migrations/20261105003047_device_pairing.sql`. Não reaplicar esse arquivo sobre o banco já criado. A função `rls_auto_enable()` permanece com execução pública revogada. As tabelas têm RLS e sem políticas de acesso direto para clientes: os avisos informativos de “RLS enabled no policy” refletem essa negação intencional. O acesso é mediado pela API autenticada de aparelhos.

A Edge Function `tv-device` lê suas credenciais de servidor do ambiente Supabase. O Site recebe a URL em `TV_DEVICE_URL` e o segredo de integração em `TV_BRIDGE_KEY`, ambos configurados no ambiente hospedado. O banco guarda somente o hash da chave, vinculado à instalação `rede8` e à página administrativa `/aparelhos`.

## Fluxo do aparelho

O APK 0.2.0 recebe uma URL de conexão Supabase e gera um QR code com código humano de oito caracteres. O administrador acessa `/aparelhos`, confere a solicitação e confirma o mesmo código da TV. O aplicativo passa a consultar as chamadas e baixar as mídias diretamente da função Supabase, sem login incorporado ou cookies do ChatGPT.

A autorização do aparelho é um segredo aleatório de 256 bits, cifrado no Android Keystore. O banco armazena apenas seu SHA-256. Códigos duram dez minutos, uso único; credenciais aprovadas duram até 90 dias e podem ser revogadas. Há limites de solicitações por origem e por instalação. O endpoint inicial é público por necessidade do pareamento; todos os demais acessos exigem credencial de aparelho ou de servidor. `verify_jwt=false` é necessário porque a função verifica suas próprias credenciais; nenhuma chave de serviço é distribuída ao APK.

## Integração do servidor

A função `supabase/functions/tv-device/index.ts` lê a chave secreta somente do ambiente padrão do Supabase. O módulo handler usa os serviços REST/Storage internos, com credenciais de servidor. Tabelas têm RLS sem política para clientes e privilégios restritos a service_role; RPCs são SECURITY INVOKER e com EXECUTE restrito a service_role. O painel continua com autenticação ChatGPT e seus perfis verificados no D1. O APK é somente leitura.

Ao ativar a integração, o primeiro acesso copia a fila D1 existente para o Supabase preservando revisão, senhas e configurações. A operação seed é idempotente e nunca sobrescreve fila remota existente. A fila passa a usar leitura e compare-and-swap no Supabase. Erros remotos não fazem fallback para uma segunda fila D1. Os vínculos de contas ChatGPT e os perfis administrativos continuam no D1.

Em Aparelhos, sincronize os arquivos de mídia para o bucket privado tv-media, por arquivo. O procedimento é idempotente e mantém a origem R2. Novos arquivos adicionados à playlist também precisam de sincronização antes do download pelo APK.

O endpoint de manutenção `/api/integration/bootstrap` permite inicializar a fila e sincronizar um arquivo existente por chamada. Exige o segredo do servidor e a barreira de acesso privada do Site; não aceita identidade de visitante simulada, não é um login alternativo e não retorna informações de contas. Seu uso é apenas por serviços autorizados.

Caminho futuro: substituir também a autenticação administrativa e os vínculos de usuários por Supabase Auth, após definir os administradores. Essa mudança não faz parte desta etapa e não pode redefinir o proprietário usando o primeiro visitante de um endpoint público.

## Testes concluídos

- 25 testes de regras existentes.
- Integração real D1/Miniflare e R2, sem regressões.
- 8 testes do handler: projeção pública, autenticação, hash de credenciais, escopo de instalação, mídia fora da playlist e expiração.
- Migração executada em Postgres embarcado PGlite: tabelas, RLS, uso único, revogação, seed idempotente, revisão atômica, limites e bloqueio dos papéis anon/authenticated.
- TypeScript e build web.
- Regras Java, QR code gerado e decodificado por ZXing, compilação do APK Android, alinhamento e assinatura v2/v3.

Comandos: `node --test tests/device-handler.test.mjs`; para o teste SQL, instale `@electric-sql/pglite@0.3.14` em ambiente de testes e execute `PGLITE_MODULE=/caminho/node_modules/@electric-sql/pglite/dist/index.js node tests/device-schema.test.mjs`.

Validação física no aparelho Android e revisão visual autenticada continuam pendentes. Os testes automatizados não certificam codecs ou o mecanismo de voz instalado no equipamento.

Validação no Supabase remoto: 17 verificações do fluxo real aprovadas, cobrindo inicialização da fila, aprovação de uso único, leitura limitada, recusa de alterações com revisão antiga e revogação imediata. Expiração confirmada em solicitação de teste. Upload autenticado de uma imagem de teste e verificação de existência no bucket privado aprovados; a verificação usa POST e leitura interna limitada a um byte, sem depender de HEAD. A migração inicial preservou 13 senhas e 3 guichês. O aparelho de teste foi revogado ao concluir.
