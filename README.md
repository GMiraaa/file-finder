# FileFinder

Plataforma de busca inteligente de arquivos. Faça upload de qualquer tipo de arquivo e use linguagem natural para encontrá-los — a IA (Gemini) analisa o conteúdo e retorna tudo que tem relação com o que você descreveu.

---

## Funcionalidades

- **Upload de arquivos** — arraste e solte ou selecione múltiplos arquivos de qualquer tipo (até 50 MB cada)
- **Busca por IA** — descreva em linguagem natural o que procura; o Gemini varre o conteúdo dos arquivos e retorna os relevantes com uma explicação
- **Extração de conteúdo** — texto extraído automaticamente de `.txt`, `.md`, `.json`, `.csv`, código-fonte, `.pdf`, `.docx` e dezenas de outros formatos
- **Interface estilo Google Drive** — grid responsivo, preview de imagens, download direto, remoção de arquivos
- **Preview por tipo** — ícones coloridos por categoria (imagem, documento, código, áudio, vídeo, etc.)

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

