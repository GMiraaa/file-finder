# FileFinder

Gerenciador de arquivos inteligente com IA. Organize seus arquivos em **Espaços** e **Pastas**, faça uploads com drag & drop e converse com o Gemini para encontrar, resumir e explorar o conteúdo dos seus documentos.

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

