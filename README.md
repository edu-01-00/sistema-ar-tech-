# Sistema de Gestão de Laboratório

Sistema web interno para gestão das operações de um laboratório ambiental:
empresa, funcionários, ensaios, legislação, clientes, pontos de coleta e
propostas comerciais/técnicas.

## Stack utilizada

- **Next.js 14** (App Router) + **TypeScript** — frontend e backend na mesma
  aplicação (páginas + rotas de API).
- **PostgreSQL** + **Prisma ORM** — banco de dados relacional, com migrations
  versionadas.
- **NextAuth.js** (Credentials Provider, sessão JWT) — autenticação por
  e-mail/senha.
- **Sistema de permissões próprio** (papéis + permissões granulares por
  módulo, com possibilidade de conceder/revogar permissões individuais por
  usuário) — aplicado no **backend**, não apenas na interface.
- **Tailwind CSS** — estilização.
- **Playwright/Chromium** — geração de documentos PDF (propostas e ordens de
  serviço de EPI) a partir de HTML renderizado com os dados salvos no banco.
- **Zod** — validação de dados no backend (além das validações de frontend).
- **Vitest** — testes automatizados das regras de negócio críticas.
- **Armazenamento de arquivos em disco local**, através de uma interface
  (`src/lib/storage.ts`) que permite trocar por um provedor externo (S3,
  Supabase Storage etc.) sem alterar o restante da aplicação.

> Nota sobre versão do Next.js: o ambiente tinha disponível a série mais
> recente do Next.js (16.x), lançada muito recentemente. Optou-se
> deliberadamente pela série estável **14.2.x** (com todos os patches de
> segurança aplicados), por ser uma versão amplamente validada em produção,
> reduzindo o risco de instabilidade em uma aplicação real de uso interno.
> Uma futura migração para versões mais novas é possível sem mudanças na
> arquitetura geral.

## Requisitos

- Node.js 20+ (recomendado 22+)
- PostgreSQL 14+
- (Opcional) Chromium/Playwright já instalado no sistema para geração de PDF —
  caso não esteja disponível, configure `PDF_CHROMIUM_EXECUTABLE_PATH` no
  `.env` apontando para um executável do Chromium/Chrome instalado, ou execute
  `npx playwright install chromium`.

## Instalação

```bash
npm install
```

## Configuração das variáveis de ambiente

Copie o arquivo de exemplo e ajuste conforme seu ambiente:

```bash
cp .env.example .env
```

Variáveis disponíveis:

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | String de conexão do PostgreSQL. |
| `NEXTAUTH_SECRET` | Chave secreta usada pelo NextAuth para assinar sessões. Gere com `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | URL base da aplicação (ex: `http://localhost:3000`). |
| `STORAGE_DRIVER` | Driver de armazenamento de documentos. Atualmente suportado: `local`. |
| `STORAGE_LOCAL_PATH` | Pasta local onde os documentos são armazenados quando `STORAGE_DRIVER=local`. |
| `PDF_CHROMIUM_EXECUTABLE_PATH` | Caminho do executável do Chromium usado para gerar PDFs. Deixe em branco para usar o Chromium padrão do Playwright. |

Nunca commite o arquivo `.env` com credenciais reais — ele já está no
`.gitignore`.

## Banco de dados

### Criar o banco (PostgreSQL local)

```sql
CREATE ROLE labapp WITH LOGIN PASSWORD 'labapp_dev_pw' CREATEDB;
CREATE DATABASE lab_management OWNER labapp;
```

Ajuste `DATABASE_URL` no `.env` conforme o usuário/senha/host utilizados.

### Migrations

O schema completo do banco é criado do zero através das migrations do Prisma
— não é necessário configurar tabelas manualmente:

```bash
npx prisma migrate deploy   # aplica as migrations existentes (produção)
# ou, em desenvolvimento, para criar novas migrations a partir de mudanças no schema:
npx prisma migrate dev
```

### Dados de exemplo (seed)

```bash
npm run prisma:seed
```

O seed cria: 1 empresa, 3 funcionários (2 com login), catálogo de EPIs e uma
ordem de serviço já aceita, 5 ensaios (nas 3 matrizes), 3 legislações
vinculadas a ensaios, 3 clientes com 2 contatos cada, 4 pontos de coleta
(cobrindo as 3 matrizes), textos técnicos base por matriz, documentos PDF
fictícios (empresa e funcionários) e 3 propostas comerciais em diferentes
status, geradas pelo mesmo fluxo usado pela aplicação (com código sequencial
real).

**Usuários de teste criados pelo seed:**

| Papel | E-mail | Senha |
| --- | --- | --- |
| Administrador | `admin@labartech.com.br` | `Admin@123` |
| Usuário padrão | `usuario@labartech.com.br` | `Usuario@123` |

Para recomeçar do zero (apaga todos os dados e reaplica migrations + seed):

```bash
npm run db:reset
```

## Executando localmente

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Testes

```bash
npm test
```

Os testes cobrem as regras de negócio mais críticas:

- Geração e formatação do código da proposta (`PR-NNN/AAAA-Rxx`).
- Reinício da numeração sequencial a cada ano.
- Controle de concorrência na geração de códigos (sem duplicidade).
- Controle de revisão (histórico preservado, nunca sobrescrito).
- Transições de status permitidas/proibidas no fluxo comercial.
- Validação de quantidade de amostras (nunca negativa).
- Cálculo de totais da proposta (ensaios, deslocamento, outros custos).
- Validação de CNPJ/CPF.
- Verificação de permissões (`hasPermission`/`hasAnyPermission`).

As duas primeiras suítes de teste rodam isoladas (sem banco); os testes de
`proposal-service` usam o banco configurado em `DATABASE_URL`, criando dados
próprios com anos "de teste" (2098/2099) e removendo tudo ao final.

## Qualidade de código

```bash
npm run typecheck   # verificação de tipos
npm run lint        # eslint
npm run build       # build de produção
```

## Build e execução em produção

```bash
npm run build
npm start
```

## Estrutura do projeto

```
prisma/
  schema.prisma        # modelo completo do banco de dados
  migrations/           # migrations versionadas
  seed.ts               # dados de demonstração
src/
  app/
    login/               # tela de login
    (app)/               # área autenticada (sidebar + topbar)
      dashboard/
      empresa/
      funcionarios/
      ensaios/
      legislacao/
      clientes/
      pontos-coleta/
      propostas/
      configuracoes/
    api/                 # rotas de backend (uma por recurso/ação)
  components/            # componentes de UI reutilizáveis e por módulo
  lib/
    auth.ts              # configuração do NextAuth
    permissions.ts       # catálogo de permissões
    guards.ts            # proteção de páginas por permissão
    api-helpers.ts        # proteção de rotas de API + tratamento de erros
    storage.ts            # abstração de armazenamento de arquivos
    services/              # regras de negócio (propostas, sequências, etc.)
    pdf/                    # geração de documentos PDF
    validations/            # schemas de validação (zod)
tests/                   # testes automatizados (vitest)
storage/                 # documentos enviados (driver local, fora do git)
```

## Estrutura do banco de dados (resumo)

- **Autenticação/permissões**: `users`, `roles`, `permissions`,
  `role_permissions`, `user_permissions`.
- **Empresa**: `companies`, `company_documents`.
- **Funcionários**: `employees`, `employee_documents`, `epi`, `epi_orders`,
  `epi_order_items`.
- **Ensaios/Legislação**: `tests`, `legislations`, `legislation_tests`
  (N:N).
- **Clientes**: `clients`, `client_contacts`.
- **Pontos de coleta**: `collection_points` + tabelas de detalhe por matriz
  (`collection_point_air_quality`, `collection_point_atmospheric_emission`,
  `collection_point_noise`), `collection_point_tests`,
  `collection_point_legislations`.
- **Propostas**: `proposals`, `proposal_matrices`, `proposal_contacts`,
  `proposal_collection_points`, `proposal_tests` (snapshot de valores),
  `proposal_costs`, `proposal_texts`, `proposal_status_history`,
  `technical_texts`, `proposal_sequences` (controle atômico da numeração
  anual).
- **Auditoria**: `audit_logs`.

Todas as tabelas possuem chaves primárias, timestamps e, quando aplicável,
`active` (soft delete/desativação) em vez de exclusão definitiva. Constraints
`unique` garantem, por exemplo, que não existam CNPJs duplicados, códigos de
parâmetro de ensaio duplicados ou códigos de proposta duplicados por
ano/sequência/revisão.

## Permissões

O controle de acesso é feito por **papéis** (roles) com um conjunto de
**permissões** granulares por módulo (ex: `clients.view`, `clients.manage`,
`proposals.status.change`). É possível conceder ou revogar uma permissão
específica para um usuário individual, sobrepondo o que vem do seu papel.

Importante: as permissões são **sempre verificadas no backend**
(`requirePermission`/`requirePagePermission`), tanto nas rotas de API quanto
nas páginas do servidor — um usuário sem permissão não consegue obter dados
mesmo acessando a URL diretamente. A interface apenas esconde ações que o
usuário não pode realizar, como camada adicional de usabilidade.

O papel `ADMINISTRADOR` é um papel de sistema e possui todas as permissões;
suas permissões não podem ser alteradas pela interface (evita que o
administrador perca acesso ao próprio sistema).

## Principais regras de negócio implementadas

1. Proposta sempre exige um cliente válido e ativo.
2. Não é permitido selecionar um contato (solicitante) de outro cliente.
3. Não é permitido selecionar um ponto de coleta de outro cliente.
4. Quantidade de amostras nunca pode ser negativa (validado no frontend e no
   backend).
5. Código da proposta é gerado automaticamente e nunca duplicado — a
   numeração sequencial é controlada por um contador atômico no banco
   (`proposal_sequences`), seguro mesmo com duas requisições simultâneas.
6. A numeração sequencial reinicia a cada ano.
7. Revisões de proposta mantêm o histórico completo — a proposta anterior
   nunca é apagada, apenas marcada como substituída (`supersededAt`).
8. Alterar o valor de um ensaio dentro de uma proposta **não** altera o
   cadastro geral do ensaio — o valor é salvo como um snapshot da proposta.
9. As matrizes selecionadas determinam quais textos técnicos aparecem na
   proposta.
10. Documentos permanecem sempre associados ao registro correto (empresa,
    funcionário ou ordem de serviço) e só podem ser baixados/excluídos por
    usuários com a permissão correspondente.
11. Toda ação relevante (criação, edição, mudança de status, exclusão de
    documentos etc.) gera um registro de auditoria (`audit_logs`).
12. Erros técnicos (ex: violação de chave estrangeira) nunca são exibidos
    diretamente ao usuário — são traduzidos para mensagens claras, com o
    detalhe técnico registrado apenas no log do servidor.

## Deploy

A aplicação está preparada para build standalone (`output: "standalone"` no
`next.config.mjs`), facilitando o deploy em containers. Para produção,
recomenda-se:

1. Banco PostgreSQL gerenciado (ex: RDS, Supabase, Neon).
2. Executar `npx prisma migrate deploy` antes de iniciar a aplicação.
3. Trocar o driver de armazenamento (`STORAGE_DRIVER`) por um provedor
   externo (ex: S3) caso o sistema de arquivos do host não seja persistente.
4. Definir `NEXTAUTH_SECRET` com um valor forte e `NEXTAUTH_URL` com a URL
   pública da aplicação.
