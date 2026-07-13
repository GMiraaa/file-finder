# FileFinder

Gerenciador de arquivos pessoal com IA e autenticação multi-usuário. Cada usuário possui espaço isolado de armazenamento, pode organizar arquivos em **Espaços** e **Pastas**, e conversa com o Gemini para encontrar, resumir, organizar e explorar o conteúdo dos seus documentos.

---

## Funcionalidades

### Autenticação
- **Cadastro e login** com nome de usuário, e-mail e senha (bcrypt + JWT)
- Sessão persistente com token armazenado no navegador (30 dias)
- Cada usuário possui diretório próprio e isolado (`c_data/users/{id}/`)
- Espaço **"Geral"** criado automaticamente no cadastro (não pode ser excluído)

### Organização de arquivos
- **Hierarquia de dois níveis** — Espaços (ex.: *Pessoal*, *Financeiro*) e Pastas dentro de cada espaço
- **Meus Arquivos** — visão flat de todos os arquivos do usuário
- **Mover entre espaços** — botão dedicado em cada card e no preview
- **Renomear arquivos** — clique no nome no modal de preview para editar inline
- **Criar arquivos** — crie arquivos de texto diretamente pelo navegador (`.txt`, `.md`, `.json`, `.csv`, `.py`, `.js`, `.html`, `.sql` e outros)
- **Seleção múltipla** — selecione vários arquivos para mover ou excluir em lote
- **Drag & drop** — mova arquivos arrastando entre pastas

### Upload
- Drag & drop ou seleção por clique, com escolha de espaço de destino
- Validação de segurança: extensões bloqueadas (`.exe`, `.dll`, `.bat`, `.ps1`, etc.) e verificação de bytes mágicos para detectar executáveis renomeados
- Prevenção de duplicatas: bloqueia upload de arquivos com nome já existente

### IA (Gemini 2.5 Flash)
- **Chat** — converse em linguagem natural sobre o conteúdo dos seus arquivos; cite arquivos específicos ou pastas inteiras como contexto
- **Organização via chat** — peça para mover arquivos por mensagem de texto; a IA propõe a ação e aguarda sua confirmação
- **Insights automáticos** — após cada upload, o Gemini analisa cada arquivo individualmente e sugere destinos em grupos (arquivos similares vão para o mesmo espaço/pasta)
- **Busca semântica** — pesquise por conteúdo, não só por nome
- **Anexos no chat** — anexe arquivos ou pastas inteiras para contextualizar a pergunta

### Visualização
- **Preview inline** — imagens, PDFs e texto diretamente no navegador
- **Filtro por extensão** — filtre arquivos por tipo no cabeçalho
- **Modo escuro** — alternância persistente sem flash
- **Extração de conteúdo** — texto extraído de `.pdf`, `.docx`, `.txt`, `.md`, `.json`, `.csv`, código-fonte e dezenas de outros formatos

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
├── a_backend/                     # API REST (FastAPI)
│   ├── main.py                    # Ponto de entrada + lifespan (cria tabelas)
│   ├── requirements.txt
│   ├── .env.example
│   └── src/
│       ├── config.py              # Configuração: diretórios, DB, JWT
│       ├── database.py            # SQLAlchemy engine + modelo User
│       ├── auth.py                # Hashing de senha + geração/validação de JWT
│       ├── dependencies.py        # Dependências FastAPI: get_current_user, get_user_data_dir
│       ├── routers/
│       │   ├── auth.py            # POST /register, POST /login
│       │   ├── files.py           # CRUD de arquivos, pastas e espaços (autenticado)
│       │   ├── chat.py            # Chat com IA (autenticado)
│       │   ├── insights.py        # Sugestões de organização (autenticado)
│       │   └── search.py          # Busca semântica (autenticado)
│       ├── services/
│       │   ├── file_service.py    # Leitura, extração e organização (user-scoped)
│       │   ├── chat_service.py    # Integração Gemini — chat + ações de organização
│       │   ├── insight_service.py # Sugestões multi-grupo via Gemini
│       │   └── gemini_service.py  # Busca semântica via Gemini
│       └── utils/helpers.py
│
├── b_frontend/                    # Interface (React + TailwindCSS)
│   └── src/
│       ├── main.jsx               # Ponto de entrada + AuthProvider
│       ├── App.jsx                # Auth guard + estado global + navegação
│       ├── contexts/
│       │   └── AuthContext.jsx    # Estado de autenticação + axios interceptor
│       ├── pages/
│       │   ├── LoginPage.jsx      # Tela de login
│       │   └── RegisterPage.jsx   # Tela de cadastro (com mensagem de sucesso)
│       ├── components/
│       │   ├── Header.jsx         # Logo + busca + filtros + usuário + sair
│       │   ├── Sidebar.jsx        # Espaços + navegação
│       │   ├── FileGrid.jsx       # Grid responsivo + seleção múltipla + toolbar
│       │   ├── FileCard.jsx       # Card com preview, download, mover e remover
│       │   ├── FolderCard.jsx     # Card de pasta com drag & drop
│       │   ├── ChatPanel.jsx      # Painel de chat com anexos e ações de org.
│       │   ├── FilePreviewModal.jsx  # Preview fullscreen + renomear
│       │   ├── MoveToSpaceModal.jsx  # Mover arquivo(s) para outro espaço
│       │   ├── CreateFileModal.jsx   # Criar arquivo de texto com editor
│       │   ├── UploadModal.jsx    # Upload com seletor de espaço + validação
│       │   └── DeleteConfirmModal.jsx
│       ├── services/api.js        # Chamadas à API (Axios, token injetado automaticamente)
│       └── utils/helpers.js      # Ícones, cores, formatadores e getFileUrl
│
├── c_data/
│   └── users/                     # Arquivos de cada usuário (isolados por ID)
│       └── {user_id}/
│           ├── Geral/             # Espaço padrão criado no cadastro
│           └── {outros espaços}/
│
├── start.sh                       # Script de inicialização completa
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
# Instalar PostgreSQL (Debian/Ubuntu)
sudo apt-get install -y postgresql postgresql-contrib
sudo service postgresql start

# Criar usuário e banco
sudo -u postgres psql -c "CREATE USER filefinder WITH PASSWORD 'filefinder';"
sudo -u postgres psql -c "CREATE DATABASE filefinder OWNER filefinder;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE filefinder TO filefinder;"

# Iniciar automaticamente no boot
sudo systemctl enable postgresql
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
source venv/bin/activate        # Windows: venv\Scripts\activate
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

### Autenticação
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/auth/register` | Cria conta (`username`, `email`, `password`) |
| `POST` | `/api/auth/login` | Faz login — retorna `access_token` |

> Todos os demais endpoints exigem o header `Authorization: Bearer <token>`.

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
| `PATCH` | `/api/files/{filename}/move` | Move arquivo entre pastas |
| `PATCH` | `/api/files/{filename}/rename` | Renomeia arquivo |
| `DELETE` | `/api/files/{filename}` | Remove arquivo |

### IA
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/chat` | Chat com IA (suporta ações de organização) |
| `POST` | `/api/insights` | Sugestões de organização por upload |
| `POST` | `/api/search` | Busca semântica por conteúdo |

### Arquivos estáticos
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/files/{user_id}/{path}` | Serve o arquivo para preview/download |

Documentação interativa: **http://localhost:3001/docs**

---

## Segurança

- **Isolamento por usuário** — cada requisição recebe o `data_dir` exclusivo via `get_user_data_dir`; `_safe_dir` impede path traversal
- **Validação de uploads** — extensões bloqueadas (executáveis, scripts) + verificação de bytes mágicos (detecta `.exe` renomeados como `.jpg`, etc.)
- **Sem IDs sequenciais expostos** — PostgreSQL SERIAL não reutiliza IDs deletados
- **JWT** com expiração configurável; senhas armazenadas com bcrypt

---

## Formatos suportados para extração de conteúdo

| Categoria | Extensões |
|---|---|
| Texto / Código | `.txt` `.md` `.json` `.csv` `.html` `.xml` `.js` `.ts` `.jsx` `.tsx` `.py` `.java` `.c` `.cpp` `.go` `.rs` `.sh` `.sql` `.yaml` e outros |
| Documentos | `.pdf` `.docx` |
| Imagens / Binários | `.jpg` `.png` `.gif` `.webp` `.mp4` `.zip` e demais — indexados por nome/extensão |

---

## Licença

Distribuído sob a licença definida no arquivo [LICENSE](LICENSE).


---

## Funcionalidades

- **Hierarquia de dois níveis** — organize em Espaços (ex.: *Pessoal*, *Equipe SAI*) e Pastas dentro de cada espaço
- **Espaço "Geral" permanente** — criado automaticamente na primeira execução; não pode ser excluído
- **Upload com seletor de destino** — arraste & solte ou selecione arquivos; escolha o espaço de destino direto no modal (padrão: *Geral*)
- **Meus Arquivos** — visão flat de todos os arquivos de todos os espaços
- **Chat com IA (Gemini)** — faça perguntas sobre seus arquivos em linguagem natural; a IA cita o arquivo e informa sua localização (Espaço › Pasta)
- **Insights automáticos** — após cada upload, o Gemini sugere o melhor espaço/pasta para organizar o arquivo
- **Preview inline** — imagens, PDFs e texto diretamente no navegador
- **Drag & drop entre pastas** — mova arquivos arrastando os cards
- **Modo escuro** — alternância automática sem flash (FOUC prevention)
- **Extração de conteúdo** — texto extraído de `.pdf`, `.docx`, `.txt`, `.md`, `.json`, `.csv`, código-fonte e dezenas de outros formatos

---

## Tecnologias

| Camada | Stack |
|---|---|
| Backend | Python 3.10+, FastAPI, Uvicorn |
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
├── a_backend/                     # API REST (FastAPI)
│   ├── main.py                    # Ponto de entrada + lifespan (cria espaço "Geral")
│   ├── requirements.txt
│   ├── .env.example
│   └── src/
│       ├── config.py              # Configuração de diretórios
│       ├── routers/
│       │   ├── files.py           # CRUD de arquivos, pastas e espaços
│       │   ├── chat.py            # Chat com IA
│       │   ├── insights.py        # Sugestões de organização
│       │   └── search.py          # Busca semântica
│       ├── services/
│       │   ├── file_service.py    # Leitura, extração e organização de arquivos
│       │   ├── chat_service.py    # Integração com Gemini (chat)
│       │   ├── insight_service.py # Sugestões espaço/pasta via Gemini
│       │   └── gemini_service.py  # Busca semântica via Gemini
│       └── utils/helpers.py
│
├── b_frontend/                    # Interface (React + TailwindCSS)
│   └── src/
│       ├── App.jsx                # Estado global e navegação
│       ├── components/
│       │   ├── Header.jsx         # Logo + busca + botão de upload
│       │   ├── Sidebar.jsx        # Espaços + navegação
│       │   ├── FileGrid.jsx       # Grid responsivo com breadcrumb
│       │   ├── FileCard.jsx       # Card com preview, download e remoção
│       │   ├── FolderCard.jsx     # Card de pasta navegável com drag & drop
│       │   ├── ChatPanel.jsx      # Painel de chat com IA
│       │   ├── FilePreviewModal.jsx # Preview fullscreen
│       │   └── UploadModal.jsx    # Upload com seletor de espaço
│       ├── services/api.js        # Chamadas à API (Axios)
│       └── utils/helpers.js      # Ícones, cores e formatadores
│
├── c_data/                        # Arquivos enviados (organizados por espaço/pasta)
│   └── Geral/                     # Espaço padrão (criado automaticamente)
├── start.sh                       # Script de inicialização completa
└── .gitignore
```

---

## Pré-requisitos

- **Python** 3.10 ou superior
- **Node.js** 18 ou superior
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
```

### 2. Inicie o projeto

```bash
./start.sh
```

O script automaticamente:
- Cria o ambiente virtual Python e instala as dependências (apenas na primeira execução)
- Instala as dependências npm do frontend (apenas na primeira execução)
- Inicia o backend na porta **3001** e o frontend na porta **5173**
- Encerra ambos os servidores com **Ctrl+C**

Acesse **http://localhost:5173**

---

### Execução manual (alternativa)

**Backend:**
```bash
cd a_backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
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

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/files?folder=` | Lista arquivos e pastas de um espaço/pasta |
| `GET` | `/api/files/all` | Lista todos os arquivos (flat) |
| `GET` | `/api/files/structure` | Retorna estrutura `{ espaço: [pastas] }` |
| `POST` | `/api/files/upload` | Envia arquivos para um espaço/pasta |
| `POST` | `/api/files/folders` | Cria uma pasta |
| `DELETE` | `/api/files/folders?path=` | Remove uma pasta |
| `PATCH` | `/api/files/{filename}/move` | Move arquivo entre pastas |
| `DELETE` | `/api/files/{filename}` | Remove um arquivo |
| `POST` | `/api/chat` | Mensagem para o chat com IA |
| `POST` | `/api/insights` | Gera sugestão de organização |
| `POST` | `/api/search` | Busca semântica por conteúdo |
| `GET` | `/files/{path}` | Serve o arquivo (download/preview) |

Documentação interativa: **http://localhost:3001/docs**

---

## Formatos suportados para extração de conteúdo

| Categoria | Extensões |
|---|---|
| Texto / Código | `.txt` `.md` `.json` `.csv` `.html` `.xml` `.js` `.ts` `.py` `.java` `.c` `.cpp` `.go` `.rs` `.sh` `.sql` e outros |
| Documentos | `.pdf` `.docx` |
| Binários | `.jpg` `.png` `.mp4` `.zip` e demais — avaliados pelo nome e extensão |

---

## Licença

Distribuído sob a licença definida no arquivo [LICENSE](LICENSE).


---

## Tecnologias

| Camada | Stack |
|--------|-------|
| Backend | Python 3.10+, FastAPI, Uvicorn |
| IA | Google Gemini 2.0 Flash (`google-genai`) |
| Extração PDF | PyMuPDF |
| Extração DOCX | python-docx |
| Frontend | React 18, Vite, TailwindCSS |
| Ícones | Lucide React |
| HTTP | Axios |

---

## Estrutura do projeto

```
file-finder/
├── a_backend/                  # API REST (FastAPI)
│   ├── main.py                 # Ponto de entrada da aplicação
│   ├── requirements.txt        # Dependências Python
│   ├── .env.example            # Modelo de variáveis de ambiente
│   └── src/
│       ├── config.py           # Configuração de diretórios
│       ├── routers/
│       │   ├── files.py        # Endpoints: listar, upload, deletar
│       │   └── search.py       # Endpoint: busca com IA
│       ├── services/
│       │   ├── file_service.py    # Leitura e extração de conteúdo
│       │   └── gemini_service.py  # Integração com Gemini API
│       └── utils/helpers.py    # Formatação de tamanho
│
├── b_frontend/                 # Interface (React + TailwindCSS)
│   └── src/
│       ├── App.jsx             # Estado global e orquestração
│       ├── components/
│       │   ├── Header.jsx      # Logo + barra de busca IA + botão upload
│       │   ├── Sidebar.jsx     # Navegação estilo Google Drive
│       │   ├── FileGrid.jsx    # Grid responsivo de arquivos
│       │   ├── FileCard.jsx    # Card com preview, download e remoção
│       │   └── UploadModal.jsx # Drag & drop com progress bar
│       ├── services/api.js     # Chamadas à API (Axios)
│       └── utils/helpers.js    # Ícones, cores e formatadores
│
├── c_data/                     # Arquivos enviados pelos usuários
├── start.sh                    # Script de inicialização completa
└── .gitignore
```

---

## Pré-requisitos

- **Python** 3.10 ou superior
- **Node.js** 18 ou superior
- **Chave de API do Gemini** — obtenha gratuitamente em [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

---

## Instalação e execução

### 1. Configure as variáveis de ambiente

```bash
cp a_backend/.env.example a_backend/.env
```

Edite `a_backend/.env` e preencha sua chave:

```env
GEMINI_API_KEY=sua_chave_aqui
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### 2. Inicie o projeto (recomendado)

```bash
./start.sh
```

O script automaticamente:
- Cria o ambiente virtual Python e instala as dependências (apenas na primeira execução)
- Instala as dependências npm do frontend (apenas na primeira execução)
- Inicia o backend na porta **3001** e o frontend na porta **5173**
- Encerra ambos os servidores ao pressionar **Ctrl+C**

---

### Execução manual (alternativa)

**Backend:**
```bash
cd a_backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 3001
```

**Frontend** (em outro terminal):
```bash
cd b_frontend
npm install
npm run dev
```

Acesse **http://localhost:5173**

---

## API — Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/files` | Lista todos os arquivos |
| `POST` | `/api/files/upload` | Envia um ou mais arquivos |
| `DELETE` | `/api/files/{filename}` | Remove um arquivo |
| `POST` | `/api/search` | Busca com IA — corpo: `{ "query": "..." }` |
| `GET` | `/files/{filename}` | Serve o arquivo para download/preview |

Documentação interativa disponível em **http://localhost:3001/docs** (Swagger UI gerado automaticamente pelo FastAPI).

---

## Formatos suportados para extração de conteúdo

| Categoria | Extensões |
|-----------|-----------|
| Texto / Código | `.txt` `.md` `.json` `.csv` `.html` `.xml` `.js` `.ts` `.py` `.java` `.c` `.cpp` `.go` `.rs` `.sh` `.sql` e outros |
| Documentos | `.pdf` `.docx` |
| Binários (apenas nome) | `.jpg` `.png` `.mp4` `.zip` e demais formatos |

> Arquivos binários sem extração de texto são avaliados pelo nome e extensão pelo modelo de IA.

---

## Licença

Distribuído sob a licença definida no arquivo [LICENSE](LICENSE).

