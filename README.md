# FileFinder

Gerenciador de arquivos pessoal com IA e autenticação multi-usuário. Cada usuário possui espaço isolado de armazenamento, pode organizar arquivos em **Espaços** e **Pastas**, e conversa com o Gemini para encontrar, resumir, organizar e editar o conteúdo dos seus documentos.

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
