# Base única, instalações independentes

O diretório `online/` no GitHub contém a base canônica hospedável. O protótipo Express da raiz é legado e não é o servidor online. Não desenvolver cópias independentes de código para cada cliente.

## Compartilhado

Telas, regras de fila, acesso, testes, migrações e correções. Uma versão de base deve ser validada na Rede8 antes de ser aplicada aos demais clientes. As atualizações não são automáticas: cada instalação recebe uma publicação da versão escolhida, preservando sua configuração, banco e acessos.

## Separado por instalação

- Site/URL e identificador `project_id` próprios.
- D1 próprio, com fila, histórico e perfis próprios. Não adicionar `tenant_id` em um banco comum: este modelo usa bancos separados.
- `config/instance.json`: configuração pública daquela instalação.
- Segredos e variáveis de execução configurados na hospedagem de cada cliente, nunca na base.
- Registro operacional em `deployments/<cliente>.json`, sem segredos.

## Configurar outro cliente

1. Partir da versão aprovada da base e preencher um JSON com o formato de `instances/example.json`.
2. Na pasta da base, executar:

```bash
node scripts/prepare-instance.mjs --config instances/cliente.json --out /workspace/sites/senhas-cliente
```

O comando exige destino vazio e não copia `.git`, o identificador do Site, credenciais, dados locais ou builds. Valida nome, cores, guichês, logomarca HTTPS, voz e layout; cria um manifesto de hospedagem sem `project_id`. Ele **não cria Site, conta, banco remoto ou publicação**.

3. Registrar um NOVO Site privado, persistir o `project_id` retornado nessa nova pasta e provisionar seu próprio D1 pelo fluxo de hospedagem. Nunca usar o ID da Rede8 para um novo cliente.
4. Instalar as dependências do lockfile, verificar TypeScript, executar os testes e publicar a instalação com a configuração escolhida. Aplicar migrações pelo fluxo de publicação. Dados de testes locais não são publicados.
5. O primeiro acesso ocorre pelo proprietário, enquanto o Site ainda está privado. Depois, cadastrar perfis e autorizar o compartilhamento separadamente quando solicitado.

Para um cliente com guichês já cadastrados no banco, mudar os valores iniciais do JSON não altera automaticamente seus guichês existentes. Definir uma migração ou ferramenta administrativa específica; não apagar dados para reaplicar padrões.

## Atualizar clientes existentes

Editar a base, testar, publicar na Rede8 e marcar a versão aprovada no GitHub. Reaplicar essa versão nos checkouts das instalações preservando `config/instance.json`, `.openai/hosting.json`, variáveis e banco. Cada publicação aplica suas próprias migrações. Não clonar um banco de cliente nem sobrescrever o identificador de hospedagem.

A configuração atual é feita por arquivos. Uma tela administrativa para personalização e os relatórios continuam como evoluções futuras; não estão implementados por esta organização da base.
