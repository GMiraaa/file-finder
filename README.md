# FileFinder

Gerenciador de arquivos pessoal com IA e autenticação multi-usuário. Cada usuário possui espaço isolado de armazenamento, pode organizar arquivos em **Espaços** e **Pastas**, e conversa com o Gemini para encontrar, resumir, organizar e editar o conteúdo dos seus documentos — através de um chat com RAG e um **agente autônomo** com function calling.

---

## Funcionalidades

### Autenticação
- **Cadastro e login** com nome de usuário, e-mail e senha (bcrypt + JWT)
- **Refresh token com rotação** — sessão renovada automaticamente; o access token expirado é trocado em background sem logout forçado
- Sessão persistente no navegador; histórico do chat preservado entre sessões
- Cada usuário possui diretório próprio e isolado (`c_data/users/{id}/`)
- Espaço **"Geral"** criado automaticamente no cadastro — permanente, não pode ser excluído

### Organização de arquivos
- **Hierarquia de dois níveis** — Espaços (ex.: *Pessoal*, *Financeiro*) e Pastas dentro de cada espaço
- **Meus Arquivos** — visão flat de todos os arquivos do usuário
- **Mover entre espaços** — botão dedicado em cada card e no preview; mover múltiplos arquivos em lote
- **Renomear** — arquivos (inline no preview) e espaços (inline na sidebar)
- **Criar arquivos de texto** — crie `.txt`, `.md`, `.json`, `.csv`, `.py`, `.js`, `.html` e outros diretamente pelo navegador
- **Seleção múltipla** — selecione vários arquivos para mover ou excluir em lote
- **Drag & drop interno** — mova arquivos arrastando cards entre pastas
- **Drag & drop externo** — arraste arquivos do gerenciador do SO para um espaço (área principal ou sidebar); validação de segurança automática

### Upload
- Drag & drop ou seleção por clique, com escolha de espaço de destino (padrão: *Geral*)
- Bloqueio de extensões perigosas (`.exe`, `.bat`, `.cmd`, `.ps1`, `.dll`, `.msi`, etc.)
- Verificação de bytes mágicos para detectar executáveis renomeados
- Prevenção de duplicatas — bloqueia upload de arquivos com nome já existente e informa a localização do original

### Visualização e edição
- **Preview + Chat integrado** — ao clicar em arquivo abre painel dividido: preview, chat da IA e árvore de navegação entre arquivos em abas à direita
- **Preview inline** — imagens, PDFs e texto diretamente no navegador
- **Edição manual** — editor de texto integrado (Ctrl+S para salvar)
- **Edição via IA** — peça para a IA modificar ou formatar o arquivo; confirme antes de aplicar
- **Desfazer edição** — reverte a última alteração aplicada pela IA
- **Filtro por extensão** — filtre arquivos por tipo no cabeçalho com checkboxes

### IA com RAG (Retrieval-Augmented Generation)
- **Embeddings locais** — `paraphrase-multilingual-MiniLM-L12-v2` (sentence-transformers) gera vetores sem consumir tokens da API
- **Banco vetorial** — ChromaDB persistente; cada arquivo é fragmentado em chunks (~800 chars) indexados automaticamente no upload
- **RAG no chat** — ao perguntar, recupera apenas os chunks mais relevantes (~5 K tokens vs. ~100 K sem RAG)
- **Busca por conteúdo** — barra de pesquisa com sugestões vetoriais em tempo real (debounce 450 ms, threshold 45%)
- **Busca semântica** — pesquisa profunda via Gemini, avaliando os candidatos retornados pelo ChromaDB

### Chat com IA
- **Streaming** — respostas aparecem progressivamente enquanto o Gemini gera (SSE)
- **Histórico persistente** — conversa preservada no `localStorage` entre sessões (limite: 200 mensagens)
- **Truncagem de histórico** — últimas 20 trocas enviadas ao Gemini (evita estouro de tokens)
- **Anexos** — cite arquivos específicos ou pastas inteiras como contexto
- **Organização via chat** — peça para a IA mover ou reorganizar arquivos; aguarda confirmação antes de agir
- **Insights automáticos** — após cada upload, o Gemini sugere destinos agrupados por similaridade
- **Analisar organização** — botão "Organizar" solicita análise completa da estrutura atual
- **Segurança nas edições** — conteúdo sexual, malicioso, de ódio ou violento é bloqueado

### Agente autônomo (FileFinder Agent)
- **Function calling** — Gemini decide autonomamente quais ferramentas usar e em que ordem
- **Streaming em tempo real** — ações executadas aparecem uma a uma; texto final gerado em streaming
- **Ferramentas disponíveis:** `search_files`, `read_file`, `list_files`, `move_file`, `create_folder`, `rename_file`, `create_file`, `append_to_file`, `replace_file_content`
- **Desfazer completo** — cada ação modificadora registra sua inversa; um clique reverte tudo na ordem correta
- **Audit log** — todas as execuções e desfazimentos são registrados no banco de dados
- **Hierarquia respeitada** — o agente distingue entre criar um Espaço (nível 1) e uma Pasta (nível 2 dentro de espaço)

### Interface
- **Modo escuro** — alternância persistente sem flash
- **Notificações** — painel com histórico de ações recentes e scrollbar customizada
- **Modais de confirmação** — exclusão de arquivos e espaços sempre pede confirmação
- **Navegação instantânea** — troca de espaços pré-carrega do cache local (zero spinner)

---

## Tecnologias

| Camada | Stack |
|---|---|
| Backend | Python 3.10+, FastAPI, Uvicorn |
| Banco de dados | PostgreSQL 16 (Docker) + SQLAlchemy + psycopg2 |
| Autenticação | JWT access token + Refresh token com rotação, bcrypt |
| IA | Google Gemini 2.5 Flash (`google-genai`) |
| RAG / Embeddings | ChromaDB + sentence-transformers (`paraphrase-multilingual-MiniLM-L12-v2`) |
| Extração PDF | PyMuPDF |
| Extração DOCX | python-docx |
| Frontend | React 18, Vite, TailwindCSS v3 |
| Ícones | Lucide React |
| HTTP | Axios (com interceptor de refresh automático) |

---

## Estrutura do projeto

```
file-finder/
├── a_backend/                        # API REST (FastAPI)
│   ├── main.py                       # Ponto de entrada + lifespan
│   ├── requirements.txt
│   ├── .env.example
│   └── src/
│       ├── config.py                 # Diretórios, DB, JWT, singleton Gemini
│       ├── database.py               # User, RefreshToken, AgentLog (SQLAlchemy)
│       ├── auth.py                   # Senha (bcrypt) + JWT + refresh token
│       ├── dependencies.py           # get_current_user, get_user_data_dir
│       ├── routers/
│       │   ├── auth.py               # /register, /login, /refresh
│       │   ├── files.py              # CRUD completo + indexação RAG em background
│       │   ├── chat.py               # Chat + streaming (SSE) + edição de arquivo via IA
│       │   ├── agent.py              # Agente autônomo + streaming + undo
│       │   ├── insights.py           # Sugestões pós-upload + análise completa
│       │   └── search.py             # Busca semântica + sugestões vetoriais em tempo real
│       ├── services/
│       │   ├── file_service.py       # CRUD de arquivos/pastas (user-scoped, path traversal safe)
│       │   ├── chat_service.py       # RAG + context building + streaming + edição por IA
│       │   ├── agent_service.py      # Loop de function calling + undo log + audit log + streaming
│       │   ├── insight_service.py    # Sugestões multi-grupo + análise de organização
│       │   ├── gemini_service.py     # Busca semântica com RAG + Gemini
│       │   └── vector_service.py     # ChromaDB: indexar, buscar, deletar, mover chunks
│       └── utils/helpers.py
│
├── b_frontend/                       # Interface (React + TailwindCSS)
│   └── src/
│       ├── App.jsx                   # Auth guard + estado global + navegação
│       ├── contexts/
│       │   ├── AuthContext.jsx       # Auth state + interceptor de refresh automático
│       │   └── NotificationsContext.jsx
│       ├── components/
│       │   ├── Header.jsx            # Busca com sugestões vetoriais + filtros + tema
│       │   ├── Sidebar.jsx           # Espaços + drop externo
│       │   ├── FileGrid.jsx          # Grid + seleção múltipla + drop externo
│       │   ├── FileCard.jsx          # Card com preview, download, mover, remover
│       │   ├── FolderCard.jsx        # Card de pasta com drag & drop
│       │   ├── ChatPanel.jsx         # Chat streaming + agente + insights + histórico persistente
│       │   ├── PreviewChatModal.jsx  # Preview split: preview + Chat / Arquivos / Agente (abas)
│       │   ├── FilePreviewModal.jsx  # Preview fullscreen standalone
│       │   ├── FileEditorModal.jsx   # Editor de texto (Ctrl+S)
│       │   ├── MoveToSpaceModal.jsx  # Mover arquivo(s) para outro espaço
│       │   ├── CreateFileModal.jsx   # Criar arquivo de texto
│       │   ├── UploadModal.jsx       # Upload com seletor de espaço + validação de duplicatas
│       │   └── DeleteConfirmModal.jsx
│       ├── services/api.js           # Axios + sendMessageStream + runAgentStream + suggestFiles
│       └── utils/helpers.js
│
├── c_data/users/{id}/                # Arquivos isolados por usuário
├── chroma_db/                        # Banco vetorial ChromaDB (gerado localmente, gitignored)
├── docker-compose.yml                # PostgreSQL 16 em container
├── start.sh                          # Inicia Docker DB + backend + frontend
└── .gitignore
```

---

## Pré-requisitos

- **Python** 3.10 ou superior
- **Node.js** 18 ou superior
- **Docker** com Docker Compose (para o PostgreSQL)
- **Chave de API do Gemini** — obtenha gratuitamente em [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

---

## Instalação e execução

### 1. Configure as variáveis de ambiente

```bash
cp a_backend/.env.example a_backend/.env
```

Edite `a_backend/.env`:

```env
GEMINI_API_KEY=sua_chave_aqui
PORT=3001
FRONTEND_URL=http://localhost:5173

# Banco de dados — container Docker (iniciado pelo start.sh)
DATABASE_URL=postgresql://filefinder:filefinder@localhost:5432/filefinder

JWT_SECRET=troque-esta-chave-em-producao
JWT_EXPIRE_DAYS=30
```

### 2. Inicie o projeto

```bash
./start.sh
```

O script automaticamente:
- Verifica se o Docker está rodando e sobe o container PostgreSQL
- Aguarda o banco ficar saudável antes de continuar
- Cria o ambiente virtual Python e instala as dependências (apenas na primeira execução)
- Instala as dependências npm do frontend (apenas na primeira execução)
- Inicia o backend na porta **3001** e o frontend na porta **5173**
- As tabelas do banco e o modelo de embeddings são criados/baixados automaticamente
- Encerra backend e frontend com **Ctrl+C** (o banco permanece rodando em background)

Acesse **http://localhost:5173**, crie uma conta e comece a usar.

> **Primeira execução:** o modelo `paraphrase-multilingual-MiniLM-L12-v2` (~471 MB) é baixado do Hugging Face automaticamente e cacheado em `~/.cache/huggingface/`. Downloads subsequentes são instantâneos.

---

### Execução manual (alternativa)

**Banco de dados:**
```bash
docker compose up -d db
```

**Backend:**
```bash
cd a_backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 3001
```

**Frontend** (em outro terminal):
```bash
cd b_frontend
npm install
npm run dev
```

---

## API — Endpoints

> Todos os endpoints abaixo (exceto `/api/auth/*`) exigem `Authorization: Bearer <token>`.

### Autenticação
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/auth/register` | Cria conta — retorna `access_token` + `refresh_token` |
| `POST` | `/api/auth/login` | Login — retorna `access_token` + `refresh_token` |
| `POST` | `/api/auth/refresh` | Troca refresh token expirado por novo par (rotação) |

### Arquivos e espaços
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/files?folder=` | Lista arquivos e pastas do espaço/pasta |
| `GET` | `/api/files/all` | Lista todos os arquivos do usuário (flat) |
| `GET` | `/api/files/structure` | Estrutura `{ espaço: [pastas] }` |
| `POST` | `/api/files/upload` | Envia arquivos + indexa no ChromaDB (background) |
| `POST` | `/api/files/create` | Cria arquivo de texto + indexa |
| `POST` | `/api/files/folders` | Cria espaço ou subpasta |
| `DELETE` | `/api/files/folders?path=` | Remove espaço/pasta + remove do índice |
| `PUT` | `/api/files/{filename}/content` | Sobrescreve conteúdo + re-indexa |
| `PATCH` | `/api/files/folders/rename` | Renomeia espaço ou subpasta |
| `PATCH` | `/api/files/{filename}/rename` | Renomeia arquivo + re-indexa |
| `PATCH` | `/api/files/{filename}/move` | Move arquivo + re-indexa |
| `DELETE` | `/api/files/{filename}` | Remove arquivo + remove do índice |

### IA e busca
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/chat` | Chat com IA (RAG + ações de organização) |
| `POST` | `/api/chat/stream` | Chat com IA — resposta em streaming (SSE) |
| `POST` | `/api/chat/file-edit` | Edição de arquivo via IA |
| `POST` | `/api/agent` | Executa agente autônomo |
| `POST` | `/api/agent/stream` | Agente com streaming de ações e texto (SSE) |
| `POST` | `/api/agent/undo` | Desfaz última execução do agente |
| `POST` | `/api/insights` | Sugestões de organização pós-upload |
| `POST` | `/api/insights/analyze-all` | Análise completa da organização |
| `POST` | `/api/search` | Busca semântica (RAG + Gemini) |
| `GET` | `/api/search/suggest?q=` | Sugestões vetoriais em tempo real (sem Gemini) |

### Arquivos estáticos
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/files/{user_id}/{path}` | Serve o arquivo para preview/download |

Documentação interativa: **http://localhost:3001/docs**

---

## Segurança

- **Isolamento por usuário** — `_safe_dir()` previne path traversal e limita a 2 níveis de profundidade; cada requisição recebe `data_dir` exclusivo
- **Validação de uploads** — extensões bloqueadas + bytes mágicos (detecta executáveis renomeados) + integridade de imagens/PDFs
- **Refresh token com rotação** — tokens armazenados como hash SHA-256; revogados imediatamente após uso
- **Filtro de conteúdo na edição** — conteúdo sexual, malicioso, violento ou de ódio rejeitado antes de qualquer escrita
- **Senhas** com bcrypt (salt aleatório por usuário)
- **ChromaDB isolado por usuário** — cada coleção vetorial é separada por `user_id`

---

## Formatos suportados para extração de conteúdo

| Categoria | Extensões |
|---|---|
| Texto / Código | `.txt` `.md` `.json` `.csv` `.html` `.xml` `.js` `.ts` `.jsx` `.tsx` `.py` `.java` `.c` `.cpp` `.go` `.rs` `.sh` `.sql` `.yaml` `.yml` e outros |
| Documentos | `.pdf` `.docx` |
| Imagens / Binários | `.jpg` `.png` `.gif` `.webp` `.mp4` `.zip` e demais — indexados por nome/extensão |

---

## Melhorias futuras

- **Armazenamento em nuvem (AWS S3)** — substituir `c_data/` por um bucket S3 para escalabilidade e redundância
- **Compartilhamento de arquivos** — permitir que usuários compartilhem arquivos ou espaços
- **Versionamento de arquivos** — histórico de versões de arquivos editados com restauração

---

## Licença

Distribuído sob a licença definida no arquivo [LICENSE](LICENSE).


---

## Funcionalidades

### Autenticação
- **Cadastro e login** com nome de usuário, e-mail e senha (bcrypt + JWT)
- Sessão persistente com token armazenado no navegador (30 dias)
- Cada usuário possui diretório próprio e isolado (`c_data/users/{id}/`)
- Espaço **"Geral"** criado automaticamente no cadastro — permanente, não pode ser excluído

### Organização de arquivos
- **Hierarquia de dois níveis** — Espaços (ex.: *Pessoal*, *Financeiro*) e Pastas dentro de cada espaço
- **Meus Arquivos** — visão flat de todos os arquivos do usuário
- **Mover entre espaços** — botão dedicado em cada card e no preview; mover múltiplos arquivos em lote
- **Renomear** — arquivos (inline no preview) e espaços (inline na sidebar)
- **Criar arquivos de texto** — crie `.txt`, `.md`, `.json`, `.csv`, `.py`, `.js`, `.html` e outros diretamente pelo navegador
- **Seleção múltipla** — selecione vários arquivos para mover ou excluir em lote
- **Drag & drop interno** — mova arquivos arrastando cards entre pastas
- **Drag & drop externo** — arraste arquivos do gerenciador do sistema operacional diretamente para um espaço (na área principal ou na sidebar); validação de segurança aplicada automaticamente

### Upload
- Drag & drop ou seleção por clique, com escolha de espaço de destino (padrão: *Geral*)
- Bloqueio de extensões perigosas (`.exe`, `.bat`, `.cmd`, `.ps1`, `.dll`, `.msi`, etc.)
- Verificação de bytes mágicos para detectar executáveis renomeados
- Prevenção de duplicatas — bloqueia upload de arquivos com nome já existente e informa a localização do original

### Visualização e edição
- **Preview + Chat integrado** — ao clicar em um arquivo, abre um painel dividido: preview à esquerda, chat da IA à direita (com o arquivo já anexado)
- **Preview inline** — imagens, PDFs e texto diretamente no navegador
- **Edição manual** — edite arquivos de texto diretamente no browser via modal de editor (Ctrl+S para salvar)
- **Edição via IA** — no chat do visualizador, peça para a IA modificar, formatar ou adicionar conteúdo ao arquivo; a IA propõe a alteração, você confirma antes de aplicar
- **Desfazer edição** — botão de desfazer no chat do visualizador para reverter a última alteração aplicada pela IA
- **Filtro por extensão** — filtre arquivos por tipo no cabeçalho

### IA (Gemini 2.5 Flash)
- **Chat de arquivos** — converse sobre o conteúdo dos seus arquivos em linguagem natural; cite arquivos específicos ou pastas inteiras como contexto
- **Organização via chat** — peça para a IA mover ou reorganizar arquivos; a IA propõe a ação e aguarda confirmação
- **Chat do visualizador** — chat focado num arquivo específico: faça perguntas ou solicite edições; histórico independente do chat principal
- **Insights automáticos** — após cada upload, o Gemini analisa cada arquivo e sugere destinos agrupados por similaridade
- **Analisar organização** — botão "Organizar" no chat solicita análise completa da estrutura atual e sugere melhorias
- **Busca semântica** — pesquise por conteúdo, não só por nome
- **Segurança nas edições** — conteúdo sexual, malicioso, de ódio ou violento é bloqueado antes de qualquer alteração nos arquivos

### Interface
- **Modo escuro** — alternância persistente sem flash (FOUC prevention)
- **Notificações** — toast de feedback em todas as ações
- **Modal de confirmação** — exclusão de arquivos e espaços sempre pede confirmação

---

## Tecnologias

| Camada | Stack |
|---|---|
| Backend | Python 3.10+, FastAPI, Uvicorn |
| Banco de dados | PostgreSQL + SQLAlchemy + psycopg2 |
| Autenticação | JWT (`python-jose`) + bcrypt |
| IA | Google Gemini 2.5 Flash (`google-genai`) |
| Extração PDF | PyMuPDF |
| Extração DOCX | python-docx |
| Frontend | React 18, Vite, TailwindCSS v3 |
| Ícones | Lucide React |
| HTTP | Axios |

---

## Estrutura do projeto

```
file-finder/
├── a_backend/                        # API REST (FastAPI)
│   ├── main.py                       # Ponto de entrada + lifespan (cria tabelas)
│   ├── requirements.txt
│   ├── .env.example
│   └── src/
│       ├── config.py                 # Configuração: diretórios, DB, JWT
│       ├── database.py               # SQLAlchemy engine + modelo User
│       ├── auth.py                   # Hashing de senha + geração/validação de JWT
│       ├── dependencies.py           # get_current_user, get_user_data_dir
│       ├── routers/
│       │   ├── auth.py               # POST /register, POST /login
│       │   ├── files.py              # CRUD completo de arquivos, pastas e espaços
│       │   ├── chat.py               # Chat com IA + edição de arquivo via IA
│       │   ├── insights.py           # Sugestões de organização + análise completa
│       │   └── search.py             # Busca semântica
│       ├── services/
│       │   ├── file_service.py       # Leitura, extração, CRUD (user-scoped)
│       │   ├── chat_service.py       # Chat Gemini + ações de organização + edição de arquivo
│       │   ├── insight_service.py    # Sugestões multi-grupo + análise completa de organização
│       │   └── gemini_service.py     # Busca semântica via Gemini
│       └── utils/helpers.py
│
├── b_frontend/                       # Interface (React + TailwindCSS)
│   └── src/
│       ├── main.jsx                  # Ponto de entrada + AuthProvider
│       ├── App.jsx                   # Auth guard + estado global + navegação
│       ├── contexts/
│       │   ├── AuthContext.jsx       # Estado de autenticação + axios interceptor
│       │   └── NotificationsContext.jsx
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   └── RegisterPage.jsx
│       ├── hooks/
│       │   └── useClosingAnimation.js
│       ├── components/
│       │   ├── Header.jsx            # Logo + busca + filtro por extensão + tema + usuário
│       │   ├── Sidebar.jsx           # Espaços + navegação + drop externo
│       │   ├── FileGrid.jsx          # Grid responsivo + seleção múltipla + drop externo
│       │   ├── FileCard.jsx          # Card com preview, download, mover e remover
│       │   ├── FolderCard.jsx        # Card de pasta com drag & drop
│       │   ├── ChatPanel.jsx         # Chat com IA + anexos + botão Organizar
│       │   ├── PreviewChatModal.jsx  # Preview split com mini-chat focado no arquivo
│       │   ├── FilePreviewModal.jsx  # Preview fullscreen standalone
│       │   ├── FileEditorModal.jsx   # Editor de texto com Ctrl+S
│       │   ├── MoveToSpaceModal.jsx  # Mover arquivo(s) para outro espaço
│       │   ├── CreateFileModal.jsx   # Criar arquivo de texto com tipo e conteúdo
│       │   ├── UploadModal.jsx       # Upload com seletor de espaço + validação
│       │   └── DeleteConfirmModal.jsx
│       ├── services/api.js           # Todas as chamadas à API (token injetado automaticamente)
│       └── utils/helpers.js         # Ícones, cores, formatadores, getFileUrl, isEditableFile
│
├── c_data/
│   └── users/                        # Arquivos isolados por usuário
│       └── {user_id}/
│           ├── Geral/                # Espaço padrão (criado no cadastro)
│           └── {outros espaços}/
│
├── start.sh                          # Script de inicialização completa
└── .gitignore
```

---

## Pré-requisitos

- **Python** 3.10 ou superior
- **Node.js** 18 ou superior
- **PostgreSQL** 14 ou superior
- **Chave de API do Gemini** — obtenha gratuitamente em [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

---

## Instalação e execução

### 1. Configure o banco de dados PostgreSQL

```bash
# Instalar (Debian/Ubuntu)
sudo apt-get install -y postgresql postgresql-contrib
sudo service postgresql start

# Criar usuário e banco
sudo -u postgres psql -c "CREATE USER filefinder WITH PASSWORD 'filefinder';"
sudo -u postgres psql -c "CREATE DATABASE filefinder OWNER filefinder;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE filefinder TO filefinder;"
```

### 2. Configure as variáveis de ambiente

```bash
cp a_backend/.env.example a_backend/.env
```

Edite `a_backend/.env`:

```env
GEMINI_API_KEY=sua_chave_aqui
PORT=3001
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://filefinder:filefinder@localhost:5432/filefinder
JWT_SECRET=troque-esta-chave-em-producao
JWT_EXPIRE_DAYS=30
```

### 3. Inicie o projeto

```bash
./start.sh
```

O script automaticamente:
- Cria o ambiente virtual Python e instala as dependências (apenas na primeira execução)
- Instala as dependências npm do frontend (apenas na primeira execução)
- Inicia o backend na porta **3001** e o frontend na porta **5173**
- As tabelas do banco são criadas automaticamente na primeira inicialização
- Encerra ambos os servidores com **Ctrl+C**

Acesse **http://localhost:5173**, crie uma conta e comece a usar.

---

### Execução manual (alternativa)

**Backend:**
```bash
cd a_backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 3001
```

**Frontend** (em outro terminal):
```bash
cd b_frontend
npm install
npm run dev
```

---

## API — Endpoints

> Todos os endpoints abaixo (exceto `/api/auth/*`) exigem `Authorization: Bearer <token>`.

### Autenticação
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/auth/register` | Cria conta (`username`, `email`, `password`) |
| `POST` | `/api/auth/login` | Faz login — retorna `access_token` |

### Arquivos e espaços
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/files?folder=` | Lista arquivos e pastas do espaço/pasta |
| `GET` | `/api/files/all` | Lista todos os arquivos do usuário (flat) |
| `GET` | `/api/files/structure` | Estrutura `{ espaço: [pastas] }` |
| `POST` | `/api/files/upload` | Envia arquivos para um espaço/pasta |
| `POST` | `/api/files/create` | Cria arquivo de texto com conteúdo |
| `POST` | `/api/files/folders` | Cria espaço ou subpasta |
| `DELETE` | `/api/files/folders?path=` | Remove espaço/pasta |
| `PUT` | `/api/files/{filename}/content` | Sobrescreve conteúdo de arquivo de texto |
| `PATCH` | `/api/files/folders/rename` | Renomeia espaço ou subpasta |
| `PATCH` | `/api/files/{filename}/rename` | Renomeia arquivo |
| `PATCH` | `/api/files/{filename}/move` | Move arquivo entre pastas |
| `DELETE` | `/api/files/{filename}` | Remove arquivo |

### IA
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/chat` | Chat com IA (Q&A + ações de organização) |
| `POST` | `/api/chat/file-edit` | Edição de arquivo via IA com filtragem de conteúdo |
| `POST` | `/api/insights` | Sugestões de organização por upload |
| `POST` | `/api/insights/analyze-all` | Análise completa da organização do usuário |
| `POST` | `/api/search` | Busca semântica por conteúdo |

### Arquivos estáticos
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/files/{user_id}/{path}` | Serve o arquivo para preview/download |

Documentação interativa: **http://localhost:3001/docs**

---

## Segurança

- **Isolamento por usuário** — cada requisição recebe `data_dir` exclusivo; `_safe_dir` impede path traversal e limita a 2 níveis de profundidade
- **Validação de uploads** — extensões bloqueadas + verificação de bytes mágicos (detecta executáveis renomeados)
- **Filtro de conteúdo na edição por IA** — conteúdo sexual, malicioso, violento ou de ódio é rejeitado antes de qualquer escrita
- **JWT** com expiração configurável; senhas armazenadas com bcrypt

---

## Formatos suportados para extração de conteúdo

| Categoria | Extensões |
|---|---|
| Texto / Código | `.txt` `.md` `.json` `.csv` `.html` `.xml` `.js` `.ts` `.jsx` `.tsx` `.py` `.java` `.c` `.cpp` `.go` `.rs` `.sh` `.sql` `.yaml` `.yml` e outros |
| Documentos | `.pdf` `.docx` |
| Imagens / Binários | `.jpg` `.png` `.gif` `.webp` `.mp4` `.zip` e demais — indexados por nome/extensão |

---

## Melhorias futuras

- **Banco de dados em container** — migrar o PostgreSQL para um container Docker, eliminando a necessidade de instalação local e facilitando o setup em qualquer ambiente com um único `docker-compose up`
- **Armazenamento em nuvem (AWS S3)** — substituir o armazenamento local de arquivos (`c_data/`) por um bucket S3 (Data Lake), proporcionando escalabilidade, redundância geográfica e acesso de qualquer instância do backend
- **Deploy containerizado** — empacotar backend e frontend em imagens Docker com `docker-compose`, simplificando o deploy em produção e ambientes de CI/CD
- **Compartilhamento de arquivos** — permitir que usuários compartilhem arquivos ou espaços com outros usuários da plataforma
- **Versionamento de arquivos** — manter histórico de versões de arquivos editados, com possibilidade de restaurar versões anteriores

---

## Licença

Distribuído sob a licença definida no arquivo [LICENSE](LICENSE).
