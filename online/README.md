# Rede8 • Senhas — piloto online privado

Versão hospedada do piloto de atendimento Rede8. Mantém o fluxo de retirada normal/prioritária, recepção e painel da base Queue System; o transporte Express/Socket.IO foi substituído por HTTP com atualização a cada 2 segundos para compatibilidade com a hospedagem Cloudflare Workers.

## Acessar

- `/`: início e atalhos.
- `/retirar`: tablet, emissão e comprovante de 58 mm.
- `/recepcao`: seleção/ocupação de guichê, chamada, repetição, conclusão e ausente.
- `/painel`: TV, chamadas e voz nativa pt-BR; toque em “Ativar som”.
- `/acessos`: administrador cadastra o e-mail e o perfil de atendentes ou administradores.

Todas as telas exigem entrada com ChatGPT. Esta publicação permanece restrita ao proprietário. O primeiro visitante autenticado é vinculado como proprietário somente porque o Site foi criado privado e continua privado; não tornar público antes dessa primeira entrada. Perfis são verificados no servidor a cada requisição. Cadastrar um perfil não altera o compartilhamento da plataforma, que deve ser autorizado separadamente pelo proprietário. O sistema não armazena senhas.

## Persistência e integridade

D1 guarda o proprietário, os perfis e a fila. Atualizações usam compare-and-swap com revisão para impedir perda de dados, números duplicados e duas chamadas da mesma senha. A emissão usa identificador de solicitação reutilizado após falha de conexão. Origem e conteúdo das mutações são validados no servidor. Dados enviados às telas não incluem identidade do operador ou logs internos. Nenhum nome ou dado clínico de paciente é solicitado.

Os prioritários precedem os normais; cada tipo segue a ordem de chegada. Validar essa preferência operacional no piloto. A mudança de data usa America/Bahia e ocorre na próxima operação, mesmo após parada do serviço. Senhas do dia anterior que ainda estavam ativas ficam canceladas. Histórico recente é limitado a 500 registros anteriores; este é um piloto, sem política de retenção para operação real. Encerrar a fila no mesmo dia cancela senhas ativas e preserva a sequência.

## Impressão

O navegador imprime página de 58 × 110 mm. Impressão automática Android/Bluetooth/USB ainda não está integrada; depende do equipamento escolhido. A voz é do dispositivo, com disponibilidade e volume a validar na TV/tablet. A marca usa composição tipográfica provisória; substituir pela logomarca oficial quando disponível.

## Desenvolver e validar

Node.js 22.13 ou superior. Use o lockfile e os scripts do projeto. O ambiente gerenciado usa pnpm.

- `npm test`: nove testes de regras, isolamento de guichês, permissões, idempotência e virada do dia.
- `npm run test:db`: teste real de D1 em Miniflare, concorrência, gravação, perfis, revogação, projeção pública e origem da requisição.
- `npx tsc --noEmit`: verificação TypeScript.
- `npm run build`: build Vinext/Cloudflare Workers.
- `npm run db:generate`: gerar novas migrações a partir de db/schema.ts. Não editar migração aplicada.

O preview gerenciado não simula login ChatGPT; as páginas protegidas redirecionam para o login disponível apenas na hospedagem. A navegação visual autenticada precisa ser validada na versão hospedada. O banco local e o hospedado são separados: os dados de teste não são publicados.

## Origem

Projeto relacionado: https://github.com/viewsmidiatv-ops/Rede8-senhas. Base inicial: Queue System, https://github.com/krispx2811/Queue-System (MIT). Esta versão online usa nova implementação de servidor compatível com Workers. O protótipo Express da raiz do repositório não é o servidor publicado.

## Modelo comercial: base única

A base agora separa o código comum da configuração do cliente. A Rede8 é a primeira instalação; veja [docs/BASE-UNICA.md](docs/BASE-UNICA.md) para preparar novos clientes e atualizar versões sem misturar bancos ou acessos. `config/instance.json` fornece nome, assinatura, símbolo/logomarca HTTPS, cores principais, guichês iniciais, velocidade de voz pt-BR e layout clássico/compacto. Essa configuração ainda é por arquivo, não por painel.
