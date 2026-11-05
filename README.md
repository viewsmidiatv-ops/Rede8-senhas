# Rede8 • Senhas

Piloto de atendimento da Rede8, adaptado do [Queue System](https://github.com/krispx2811/Queue-System), sob licença MIT. Mantidos os créditos em `LICENSE`.

## Telas

| Endereço | Uso |
| --- | --- |
| `/retirar` | Tablet: escolher atendimento normal ou prioritário e emitir senha |
| `/recepcao` | Computador: selecionar guichê, chamar, repetir e concluir |
| `/painel` | TV: chamadas e fila, com voz em português |
| `/track` | Consulta da senha; o comprovante contém um QR Code |

As rotas originais `/kiosk`, `/admin` e `/display` continuam disponíveis.

## Iniciar o piloto no computador

Use Node.js 22.12 ou superior.

```bash
npm ci
npm run build
npm run server
```

Abra `http://localhost:3210`. Por padrão, o servidor aceita conexões somente do próprio computador. O piloto funciona sem Supabase, salvando os dados em `server/data.json` (ignorado pelo Git). Não apague esse arquivo durante o funcionamento.

Para desenvolvimento: `npm run dev` inicia servidor e Vite; abra `http://localhost:5173`.

Os dados iniciais incluem dois guichês e duas filas. A numeração é única, compartilhada entre filas: `N-001`, `P-002`, `N-003` etc. A fila prioritária tem preferência; dentro de cada tipo, vale a ordem de emissão. Encaminhamentos explícitos para um guichê conservam a precedência original. A preferência contínua pode prolongar a espera normal; validar a regra operacional no piloto.

Os padrões são aplicados apenas em armazenamento novo. Dados existentes são preservados e precisam ser revisados pelo administrador; não há migração automática das filas antigas.

## Acesso de demonstração

As senhas herdadas do projeto servem apenas para testar a interface: atendente `FEC@1` e administração `2811`. **Não são autenticação segura**: estão no JavaScript e os eventos do servidor ainda não exigem sessão. Alterar essas senhas pela interface não corrige essa limitação.

Este piloto deve permanecer no computador de testes. Antes de expor em rede ou hospedar, implementar autenticação e autorização no servidor, restringir dados transmitidos ao painel público, revisar persistência/backup e testar os dispositivos reais. Não inserir nomes ou dados clínicos no piloto.

A chave de voz presente no código original foi removida dos padrões e da sincronização pública. Ela permanece no histórico original; deve ser considerada exposta e revogada pelo responsável pelo serviço. Nenhuma chave ou conta de terceiros é necessária para a voz padrão deste piloto.

## Impressão e áudio

O comprovante usa largura de 58 mm, com página de 110 mm e conteúdo dentro da área imprimível. A impressão atual abre a caixa de impressão do navegador. **Não existe ainda integração Bluetooth/USB nem impressão automática Android**: escolher a impressora e integrar o SDK ou aplicativo de impressão antes de instalar o totem.

O painel usa a voz nativa do navegador em `pt-BR`. A voz precisa estar disponível no dispositivo. Toque no painel para liberar o áudio e faça um teste antes do atendimento. O volume do sistema também precisa estar habilitado.

A logomarca oficial não está incluída: a versão usa o nome Rede8, cor roxa `#342E4E` e a assinatura “É da gente. É daqui.”. O campo de URL da logomarca permanece disponível nas configurações.

## Persistência e virada do dia

O armazenamento JSON atende a um único processo de servidor. Para produção, usar banco persistente e revisar os acessos. A integração Supabase original permanece opcional, mas não foi provisionada nem testada nesta etapa.

A rotina herdada reinicia a fila entre 01:00 e 01:04, agora no fuso `America/Bahia`, e depende de o servidor estar ligado nesse intervalo. Não é uma virada de dia garantida após parada/reinício. Essa rotina também limpa o histórico de senhas; definir retenção e arquivamento antes de uso real.

## Validação

```bash
npm test
npm run test:smoke
```

Os testes cobrem prioridade/FIFO, guichês simultâneos, categoria inválida, filtros e encaminhamentos, textos de voz, emissão pela API, sincronização entre clientes e as três rotas. O teste integrado usa arquivo temporário e não modifica a fila local.

`npm run lint` já apresenta erros no projeto original. A tradução dos menus avançados e dos 23 layouts também precisa de revisão posterior. A validação visual em navegador e a impressão física não foram concluídas neste ambiente.
