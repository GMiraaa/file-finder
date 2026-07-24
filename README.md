<img src="b_frontend/public/Bob-2.png" alt="FileFinder mascote" width="120" align="right" />

# FileFinder

Gerenciador de arquivos pessoal com IA, autenticação multi-usuário e espaços compartilhados. Cada usuário possui armazenamento isolado, pode organizar arquivos em **Espaços** e **Subpastas**, compartilhar espaços com outros usuários (viewer / editor), e conversar com o Gemini para encontrar, resumir, organizar e editar o conteúdo dos documentos — através de um chat com RAG e um **agente autônomo** com function calling.

---

## Funcionalidades

### Autenticação e Perfil
- **Cadastro e login** com nome de usuário, e-mail e senha (bcrypt + JWT)
- **Refresh token com rotação** — sessão renovada automaticamente em background sem logout forçado
- **Gestão de perfil** — altere nome, e-mail ou senha; exclua a conta com confirmação dupla
- Cada usuário possui diretório próprio e isolado (`c_data/users/{id}/`)
- Espaço **"Geral"** criado automaticamente no cadastro — permanente e não pode ser excluído

### Organização de Arquivos
- **Hierarquia de dois níveis** — Espaços (ex.: *Pessoal*, *Financeiro*) e Subpastas dentro de cada espaço
- **Meus Arquivos** — visão flat de todos os arquivos com paginação (*Mostrar mais*)
- **Recentes** — 20 arquivos modificados mais recentemente
- **Mover entre espaços** — botão por arquivo e movimentação em lote (seleção múltipla)
- **Renomear** — arquivos e espaços/pastas com edição inline
- **Criar arquivos de texto** — crie `.txt`, `.md`, `.json`, `.csv`, `.py`, `.js`, `.html` e outros diretamente no browser
- **Seleção múltipla** — selecione arquivos para mover, excluir ou **baixar em lote (ZIP)**
- **Drag & drop interno** — mova arquivos arrastando cards entre pastas e espaços
- **Drag & drop externo** — arraste arquivos do SO para a área principal ou sidebar

### Upload
- Drag & drop ou seleção por clique, com escolha de espaço de destino (padrão: *Geral*)
- **Bloqueio de extensões perigosas** (`.exe`, `.bat`, `.cmd`, `.ps1`, `.dll`, `.msi`, `.jar`, etc.)
- **Verificação de bytes mágicos** — detecta executáveis renomeados independente da extensão
- **Prevenção de duplicatas** — bloqueia upload com nome já existente e informa onde está o original
- Limite de 50 MB por arquivo

### Lixeira
- **Soft delete** — arquivos excluídos vão para a Lixeira em vez de serem deletados permanentemente
- **Retenção de 30 dias** — badge vermelho de aviso para itens com ≤ 3 dias restantes
- **Restaurar** — retorna o arquivo ao local original (com fallback automático se a pasta foi removida)
- **Excluir permanentemente** — item a item ou *Esvaziar lixeira* de uma vez
- Exclusões em espaços compartilhados por editores continuam sendo permanentes

### Espaços Compartilhados
- **Convites por e-mail** — dono convida com permissão **Viewer** ou **Editor**
- **Notificações em tempo real** — convites chegam via SSE sem recarregar a página
- **Viewer** — pode visualizar e baixar arquivos; botões de criação/upload bloqueados
- **Editor** — pode criar pastas, fazer upload, criar/editar/mover/renomear/excluir arquivos
- **Alterar permissão** — dono promove Viewer → Editor ou rebaixa Editor → Viewer a qualquer momento
- **Remover membro / cancelar convite** — direto no modal de configurações do espaço
- **Log de atividade** — dono vê as últimas 50 ações realizadas pelos colaboradores no espaço

### Armazenamento
- **Cota por usuário** — barra de progresso na sidebar mostra uso atual / 1 GB
- Cor da barra muda para **amarelo** acima de 70% e **vermelho** acima de 90%

### Visualização e Edição
- **Preview + Chat integrado** — ao clicar em arquivo, painel dividido: preview + chat da IA com o arquivo já anexado
- **Preview inline** — imagens, PDFs e texto diretamente no browser (autenticação via `?token=`)
- **Edição manual** — editor de texto integrado (Ctrl+S para salvar)
- **Edição via IA** — peça para a IA modificar o arquivo; confirme antes de aplicar
- **Desfazer edição** — reverte a última alteração aplicada pela IA com um clique
- **Filtro por extensão** — filtre por tipo de arquivo com checkboxes no cabeçalho

### IA com RAG (Retrieval-Augmented Generation)
- **Embeddings locais** — `paraphrase-multilingual-MiniLM-L12-v2` (sentence-transformers) sem consumir tokens da API
- **ChromaDB persistente** — cada arquivo é fragmentado em chunks (~800 chars) indexados no upload
- **RAG no chat** — recupera apenas os chunks mais relevantes (~5 K tokens vs. ~100 K sem RAG)
- **Busca por conteúdo** — barra de pesquisa com sugestões vetoriais em tempo real (debounce 450 ms)
- **Busca semântica** — pesquisa profunda via Gemini com re-ranking dos candidatos do ChromaDB

### Chat com IA
- **Streaming** — respostas aparecem progressivamente via SSE enquanto o Gemini gera
- **Histórico persistente** — conversa salva no `localStorage` entre sessões (limite: 200 mensagens)
- **Truncagem de histórico** — últimas 20 trocas enviadas ao Gemini (evita estouro de tokens)
- **Anexos** — cite arquivos específicos ou pastas inteiras como contexto
- **Organização via chat** — a IA move/reorganiza arquivos após confirmação
- **Insights automáticos** — após upload, Gemini sugere destinos agrupados por similaridade
- **Segurança nas edições** — conteúdo malicioso, sexual, de ódio ou violento é bloqueado

### Agente Autônomo (FileFinder Agent)
- **Function calling** — Gemini decide autonomamente quais ferramentas usar e em que ordem
- **Streaming em tempo real** — ações executadas aparecem uma a uma com texto gerado em streaming
- **Ferramentas:** `search_files`, `read_file`, `list_files`, `move_file`, `create_folder`, `rename_file`, `create_file`, `append_to_file`, `replace_file_content`
- **Desfazer completo** — cada ação registra sua inversa; um clique reverte tudo na ordem correta
- **Audit log** — todas as execuções e desfazimentos são registrados no banco

### Interface
- **Modo escuro** — alternância persistente sem flash (FOUC prevention)
- **Mascote Bob** — personagem animado nos estados vazios (sem arquivos, busca sem resultado, lixeira vazia, pasta vazia, etc.) com círculo de fundo adaptativo (claro/escuro)
- **Modais de confirmação** — exclusão de arquivos, pastas e conta sempre pedem confirmação
- **Navegação instantânea** — troca de espaços pré-carrega do cache local

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
| HTTP | Axios (com interceptor de refresh automático + timeout 30 s) |

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
│       ├── database.py               # Modelos: User, RefreshToken, AgentLog,
│       │                             #   SpaceShare, SpaceInvite, TrashItem, SpaceActivity
│       ├── auth.py                   # bcrypt + JWT + refresh token
│       ├── dependencies.py           # get_current_user, get_user_data_dir
│       ├── limiter.py                # Rate limiting (slowapi)
│       ├── routers/
│       │   ├── auth.py               # /register /login /refresh /me /profile /password /account
│       │   ├── files.py              # CRUD arquivos/pastas + indexação RAG + download ZIP
│       │   │                         #   + storage-info + soft delete (lixeira)
│       │   ├── spaces.py             # Compartilhamento: convites, membros, permissões,
│       │   │                         #   SSE de convites, log de atividade
│       │   ├── trash.py              # Lixeira: listar, restaurar, excluir, esvaziar
│       │   ├── chat.py               # Chat + streaming (SSE) + edição via IA
│       │   ├── agent.py              # Agente autônomo + streaming + undo
│       │   ├── insights.py           # Sugestões pós-upload + análise completa
│       │   └── search.py             # Busca semântica + sugestões vetoriais
│       ├── services/
│       │   ├── file_service.py       # CRUD de arquivos/pastas (path traversal safe)
│       │   ├── chat_service.py       # RAG + streaming + edição por IA
│       │   ├── agent_service.py      # Function calling + undo log + audit log
│       │   ├── insight_service.py    # Sugestões multi-grupo + análise de organização
│       │   ├── gemini_service.py     # Busca semântica com RAG + Gemini
│       │   └── vector_service.py     # ChromaDB: indexar, buscar, deletar, mover
│       └── utils/helpers.py
│
├── b_frontend/                       # Interface (React + TailwindCSS)
│   ├── public/                       # Mascote Bob (Bob-1.png … Bob-6.png)
│   └── src/
│       ├── App.jsx                   # Auth guard + estado global + navegação
│       ├── contexts/
│       │   ├── AuthContext.jsx       # Auth state + updateUser + logout
│       │   └── NotificationsContext.jsx  # Toasts + convites SSE (isolado por usuário)
│       ├── components/
│       │   ├── Header.jsx            # Busca vetorial + filtros + tema + perfil
│       │   ├── Sidebar.jsx           # Espaços + compartilhados + lixeira + barra de cota
│       │   ├── FileGrid.jsx          # Grid + seleção múltipla + estados vazios com Bob
│       │   ├── FileCard.jsx          # Card com preview, download, mover, remover
│       │   ├── FolderCard.jsx        # Card com drag & drop + modal exclusão + Bob vazio
│       │   ├── ChatPanel.jsx         # Chat streaming + agente + insights
│       │   ├── TrashView.jsx         # Lixeira: listar, restaurar, excluir permanentemente
│       │   ├── ProfileModal.jsx      # Editar perfil, alterar senha, excluir conta
│       │   ├── SpaceSettingsModal.jsx # Renomear, convidar, membros, permissões,
│       │   │                          #   atividade, excluir espaço
│       │   ├── UploadModal.jsx       # Upload com seletor de espaços (privados + compartilhados)
│       │   ├── CreateFileModal.jsx   # Criar arquivo de texto
│       │   ├── PreviewChatModal.jsx  # Split: preview + Chat / Arquivos / Agente (abas)
│       │   ├── FilePreviewModal.jsx  # Preview fullscreen standalone
│       │   ├── FileEditorModal.jsx   # Editor de texto (Ctrl+S)
│       │   ├── MoveToSpaceModal.jsx  # Mover arquivo(s)
│       │   ├── DeleteConfirmModal.jsx
│       │   └── ErrorBoundary.jsx
│       ├── pages/
│       │   ├── LoginPage.jsx         # Login com Bob decorativo
│       │   └── RegisterPage.jsx      # Cadastro com Bob + Bob no sucesso
│       ├── services/api.js           # Axios + todas as chamadas de API
│       └── utils/helpers.js
│
├── c_data/
│   ├── users/{id}/                   # Arquivos isolados por usuário
│   └── .trash/{id}/                  # Lixeira física por usuário (gitignored)
├── chroma_db/                        # Banco vetorial ChromaDB (gitignored)
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
- Cria/migra tabelas do banco e baixa o modelo de embeddings automaticamente
- Encerra backend e frontend com **Ctrl+C** (o banco permanece em background)

Acesse **http://localhost:5173**, crie uma conta e comece a usar.

> **Primeira execução:** o modelo `paraphrase-multilingual-MiniLM-L12-v2` (~471 MB) é baixado do Hugging Face e cacheado em `~/.cache/huggingface/`. Downloads subsequentes são instantâneos.

---

### Execução manual (alternativa)

**Banco de dados:**
```bash
docker compose up -d db
```

**Backend:**
```bash
cd a_backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 3001
```

**Frontend** (em outro terminal):
```bash
cd b_frontend
npm install && npm run dev
```

---

## API — Endpoints

> Todos os endpoints abaixo (exceto `/api/auth/register`, `/api/auth/login` e `/api/auth/refresh`) exigem `Authorization: Bearer <token>`.

### Autenticação e Perfil
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/auth/register` | Cria conta |
| `POST` | `/api/auth/login` | Login — retorna `access_token` + `refresh_token` |
| `POST` | `/api/auth/refresh` | Renova tokens (rotação) |
| `GET`  | `/api/auth/me` | Dados do usuário autenticado |
| `PUT`  | `/api/auth/profile` | Atualiza nome de usuário e/ou e-mail |
| `PUT`  | `/api/auth/password` | Altera senha (exige senha atual) |
| `DELETE` | `/api/auth/account` | Exclui conta e todos os dados |

### Arquivos e Espaços
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/files?folder=&owner_id=` | Lista arquivos e pastas |
| `GET` | `/api/files/all` | Lista todos os arquivos do usuário (flat) |
| `GET` | `/api/files/structure` | Estrutura `{ espaço: [pastas] }` |
| `GET` | `/api/files/storage-info` | Uso de armazenamento e cota (1 GB) |
| `GET` | `/api/files/serve/{user_id}/{path}` | Serve arquivo com validação JWT |
| `POST` | `/api/files/upload?folder=&owner_id=` | Envia arquivos + indexa no ChromaDB |
| `POST` | `/api/files/create?owner_id=` | Cria arquivo de texto + indexa |
| `POST` | `/api/files/folders?owner_id=` | Cria espaço ou subpasta |
| `POST` | `/api/files/download-zip` | Baixa arquivos selecionados como ZIP |
| `DELETE` | `/api/files/folders?path=` | Remove espaço/pasta |
| `PUT` | `/api/files/{filename}/content` | Sobrescreve conteúdo + re-indexa |
| `PATCH` | `/api/files/folders/rename` | Renomeia espaço ou subpasta |
| `PATCH` | `/api/files/{filename}/rename?owner_id=` | Renomeia arquivo |
| `PATCH` | `/api/files/{filename}/move?owner_id=` | Move arquivo |
| `DELETE` | `/api/files/{filename}?owner_id=` | Soft delete (lixeira) para arquivos próprios; hard delete em espaços compartilhados |

### Lixeira
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/trash` | Lista itens da lixeira |
| `POST` | `/api/trash/{id}/restore` | Restaura arquivo ao local original |
| `DELETE` | `/api/trash/{id}` | Exclui item permanentemente |
| `DELETE` | `/api/trash/empty` | Esvazia a lixeira |

### Espaços Compartilhados
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/spaces/shared` | Espaços compartilhados com o usuário |
| `GET` | `/api/spaces/invites` | Convites pendentes |
| `GET` | `/api/spaces/invites/stream` | SSE: stream de novos convites em tempo real |
| `POST` | `/api/spaces/invites/{id}/accept` | Aceita convite |
| `POST` | `/api/spaces/invites/{id}/decline` | Recusa convite |
| `POST` | `/api/spaces/{name}/invite` | Convida usuário por e-mail |
| `GET` | `/api/spaces/{name}/members` | Lista membros + convites pendentes |
| `PATCH` | `/api/spaces/{name}/members/{uid}` | Altera permissão de membro (viewer ↔ editor) |
| `DELETE` | `/api/spaces/{name}/members/{uid}` | Remove membro |
| `DELETE` | `/api/spaces/{name}/invites/{iid}` | Cancela convite pendente |
| `GET` | `/api/spaces/{name}/activity` | Últimas 50 ações no espaço |

### IA e Busca
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/chat/stream` | Chat streaming (SSE) com RAG |
| `POST` | `/api/chat/file-edit` | Edição de arquivo via IA |
| `POST` | `/api/agent/stream` | Agente autônomo com streaming |
| `POST` | `/api/agent/undo` | Desfaz última execução do agente |
| `POST` | `/api/insights` | Sugestões de organização pós-upload |
| `POST` | `/api/insights/analyze-all` | Análise completa da organização |
| `POST` | `/api/search` | Busca semântica (RAG + Gemini) |
| `GET` | `/api/search/suggest?q=` | Sugestões vetoriais em tempo real |

Documentação interativa: **http://localhost:3001/docs**

---

## Segurança

- **Isolamento por usuário** — `_safe_dir()` previne path traversal e limita a 2 níveis de profundidade
- **Validação de uploads** — extensões bloqueadas + bytes mágicos + integridade de imagens/PDFs
- **Refresh token com rotação** — armazenados como hash SHA-256; revogados imediatamente após uso
- **Rate limiting** — endpoint de login limitado a 10 req/min (slowapi)
- **Permissões em espaços compartilhados** — viewer não pode escrever; editor verificado em cada operação de escrita
- **Filtro de conteúdo na edição IA** — conteúdo malicioso, sexual, violento ou de ódio rejeitado antes de qualquer escrita
- **Senhas** com bcrypt (salt aleatório por usuário)
- **ChromaDB isolado** — coleção vetorial separada por `user_id`
- **Timeout de 30 s no Axios** — requisições não ficam pendentes indefinidamente

---

## Formatos suportados para extração de conteúdo

| Categoria | Extensões |
|---|---|
| Texto / Código | `.txt` `.md` `.json` `.csv` `.html` `.xml` `.js` `.ts` `.jsx` `.tsx` `.py` `.java` `.c` `.cpp` `.go` `.rs` `.sh` `.sql` `.yaml` `.yml` e outros |
| Documentos | `.pdf` `.docx` |
| Imagens / Binários | `.jpg` `.png` `.gif` `.webp` e demais — indexados por nome/extensão |

---

## Licença

Distribuído sob a licença definida no arquivo [LICENSE](LICENSE).
