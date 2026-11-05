# Rede8 • Senhas — piloto online privado

Versão hospedada do piloto de atendimento Rede8. Mantém o fluxo de retirada normal/prioritária, recepção e painel da base Queue System; o transporte Express/Socket.IO foi substituído por HTTP com atualização a cada 2 segundos para compatibilidade com a hospedagem Cloudflare Workers.

## Acessar

- `/`: início e atalhos.
- `/retirar`: tablet, emissão e comprovante de 58 mm.
- `/recepcao`: seleção/ocupação de guichê, chamada, repetição, conclusão e ausente.
- `/painel`: TV, chamadas e voz nativa pt-BR; toque em “Ativar som”.
- `/configuracoes`: marca, serviços, guichês, voz, layout e mídia indoor.
- `/acessos`: administrador cadastra o e-mail e o perfil de atendentes ou administradores.

Todas as telas exigem entrada com ChatGPT. Esta publicação permanece restrita ao proprietário. O primeiro visitante autenticado é vinculado como proprietário somente porque o Site foi criado privado e continua privado; não tornar público antes dessa primeira entrada. Perfis são verificados no servidor a cada requisição. Cadastrar um perfil não altera o compartilhamento da plataforma, que deve ser autorizado separadamente pelo proprietário. O sistema não armazena senhas.

## Persistência e integridade

D1 guarda o proprietário, os perfis e a fila. Atualizações usam compare-and-swap com revisão para impedir perda de dados, números duplicados e duas chamadas da mesma senha. A emissão usa identificador de solicitação reutilizado após falha de conexão. Origem e conteúdo das mutações são validados no servidor. Dados enviados às telas não incluem identidade do operador ou logs internos. Nenhum nome ou dado clínico de paciente é solicitado.

Os prioritários precedem os normais; cada tipo segue a ordem de chegada. Validar essa preferência operacional no piloto. A mudança de data usa America/Bahia e ocorre na próxima operação, mesmo após parada do serviço. Senhas do dia anterior que ainda estavam ativas ficam canceladas. Histórico recente é limitado a 500 registros anteriores; este é um piloto, sem política de retenção para operação real. Encerrar a fila no mesmo dia cancela senhas ativas e preserva a sequência.

## Impressão

O navegador imprime página de 58 × 110 mm. Impressão automática Android/Bluetooth/USB ainda não está integrada; depende do equipamento escolhido. A voz é do dispositivo, com disponibilidade e volume a validar na TV/tablet. A marca usa composição tipográfica provisória; substituir pela logomarca oficial quando disponível.

## Desenvolver e validar

Node.js 22.13 ou superior. Use o lockfile e os scripts do projeto. O ambiente gerenciado usa pnpm.

- `npm test`: testes de regras, isolamento de guichês, permissões, idempotência e virada do dia.
- `npm run test:db`: teste real de D1 em Miniflare, concorrência, gravação, perfis, revogação, projeção pública e origem da requisição.
- `npx tsc --noEmit`: verificação TypeScript.
- `npm run build`: build Vinext/Cloudflare Workers.
- `npm run db:generate`: gerar novas migrações a partir de db/schema.ts. Não editar migração aplicada.

O preview gerenciado não simula login ChatGPT; as páginas protegidas redirecionam para o login disponível apenas na hospedagem. A navegação visual autenticada precisa ser validada na versão hospedada. O banco local e o hospedado são separados: os dados de teste não são publicados.

## Origem

Projeto relacionado: https://github.com/viewsmidiatv-ops/Rede8-senhas. Base inicial: Queue System, https://github.com/krispx2811/Queue-System (MIT). Esta versão online usa nova implementação de servidor compatível com Workers. O protótipo Express da raiz do repositório não é o servidor publicado.

## Modelo comercial: base única

A base agora separa o código comum da configuração do cliente. A Rede8 é a primeira instalação; veja [docs/BASE-UNICA.md](docs/BASE-UNICA.md) para preparar novos clientes e atualizar versões sem misturar bancos ou acessos. `config/instance.json` fornece nome, assinatura, símbolo/logomarca HTTPS, cores principais, guichês iniciais, velocidade de voz pt-BR e layout clássico/compacto. Os arquivos definem os padrões iniciais; as configurações da instalação podem ser editadas no painel e são persistidas no banco.

## Painel de configurações

Acesse `/configuracoes` com o perfil de administrador. O painel oferece marca e textos, envio de logomarca PNG/JPG/WebP de até 2 MB (R2), cores, fontes, tamanho de texto e bordas; serviços com prefixos e opção prioritária; guichês com serviços habilitados; voz disponível no dispositivo, velocidade, volume, toque e frases; layout clássico/destaque e posição/quantidade do histórico. Salvar aplica as alterações às telas conectadas na atualização automática.

As configurações são persistidas no mesmo D1 da instalação. Não é necessária conta Supabase para esta etapa. O novo armazenamento R2 da instalação é usado para as logomarcas. A mídia indoor usa o mesmo R2 para os arquivos e o D1 para a playlist. O APK Android, os relatórios e a impressão Bluetooth continuam fora desta entrega.

Dados antigos são compatibilizados sem apagar senhas ou acessos. Serviços e guichês são desativados, não removidos. Senhas já emitidas mantêm nome, cor e prefixo originais. Um guichê em atendimento não pode ser desativado ou ter os serviços alterados até concluir a senha. A gravação de configurações rejeita versões antigas para evitar sobrescrita por outro administrador.

A escolha de voz lista as vozes pt-BR que o navegador do aparelho disponibiliza; não há catálogo universal de vozes masculinas/femininas. Testar no computador não garante a mesma voz na TV. Na ausência da voz escolhida, o painel usa uma voz pt-BR disponível.

Validação: 25 testes unitários, integração dos endpoints de mídia com R2 e intervalos de vídeo, integração real de D1 incluindo salvamento concorrente com emissão de senhas, TypeScript e compilação de produção. O fluxo visual autenticado e a reprodução física na TV ainda precisam ser validados pelo proprietário no equipamento.

## Mídia indoor

Em `/configuracoes`, abra **Mídia indoor**. Envie PNG/JPG/WebP ou MP4/WebM (até 20 MB por arquivo e 30 conteúdos por playlist), defina o nome e ative os itens. As setas alteram a ordem; imagens ficam de 5 a 300 segundos e vídeos avançam ao terminar, com limite de 5 minutos. A sequência reinicia automaticamente. “Retirar da playlist” remove a referência, sem apagar o arquivo do armazenamento; arquivos enviados e descartados ainda ocupam espaço no R2. Não há limpeza automática nesta versão.

Ative a tela dividida, escolha o lado, 50/60/70% da largura para conteúdo e enquadramento inteiro/recorte. Salve para aplicar à mesma URL `/painel`. Sem mídia ativa, permanece o painel de senhas anterior. Na divisão, o histórico é agrupado abaixo da senha; o modelo Destaque oculta o histórico. O vídeo da TV fica sempre mudo. Prefira MP4 H.264 Full HD e valide o codec no dispositivo alvo.

Uploads exigem administrador, autenticação e mesma origem. Arquivos são reconhecidos pela assinatura, armazenados com identificador aleatório e servidos somente a visitantes autenticados, incluindo suporte a Range para reprodução de vídeo. Conteúdo com erro é pulado com nova tentativa no próximo ciclo; falha de autoplay oferece botão para iniciar os vídeos.

Esta é a versão web: depende de internet, sem download offline, pareamento de aparelho, agendamento ou múltiplas playlists. Esses recursos e o APK são etapas futuras. O preview gerenciado esteve indisponível por conflito de servidor, então a revisão visual autenticada e a validação física da TV permanecem pendentes.

- `npm run test:media`: testa os endpoints reais com R2 em Miniflare (identidade simulada apenas no fixture), incluindo autenticação, perfis, origem, assinatura e resposta parcial de vídeo.

## Ativação das TVs pelo Supabase

Abra `/aparelhos` como administrador para conferir um código temporário, autorizar uma TV e revogar aparelhos. O APK 0.2.0 gera QR code/código sem login incorporado. A fila usa o Supabase após a inicialização idempotente a partir dos dados D1; os acessos administrativos continuam autenticados com ChatGPT. O painel permite sincronizar arquivos R2 para o bucket privado usado pelas TVs. Veja [docs/SUPABASE-APARELHOS.md](docs/SUPABASE-APARELHOS.md).
