#!/bin/bash
# FileFinder — inicia banco de dados (Docker), backend (FastAPI) e frontend (React/Vite)

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Cores ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'
YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── Banner ───────────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
echo "  ╔═══════════════════════════════════╗"
echo "  ║         FileFinder  v2.0          ║"
echo "  ║   FastAPI + React + Gemini AI     ║"
echo "  ╚═══════════════════════════════════╝"
echo -e "${NC}"

# ── Pré-requisitos ───────────────────────────────────────────────────────────
if [ ! -f "$ROOT_DIR/a_backend/.env" ]; then
  echo -e "${RED}${BOLD}ERRO:${NC}${RED} a_backend/.env não encontrado!${NC}"
  echo -e "  Execute: ${YELLOW}cp a_backend/.env.example a_backend/.env${NC}"
  echo -e "  E preencha sua ${BOLD}GEMINI_API_KEY${NC}."
  exit 1
fi

GEMINI_KEY=$(grep -E '^GEMINI_API_KEY=' "$ROOT_DIR/a_backend/.env" | cut -d'=' -f2- | tr -d ' ')
if [ -z "$GEMINI_KEY" ] || [ "$GEMINI_KEY" = "sua_chave_de_api" ]; then
  echo -e "${RED}${BOLD}ERRO:${NC}${RED} GEMINI_API_KEY não configurada em a_backend/.env!${NC}"
  echo -e "  Obtenha sua chave em: ${CYAN}https://aistudio.google.com/apikey${NC}"
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  echo -e "${RED}ERRO: Python 3 não encontrado. Instale Python 3.10+${NC}"
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo -e "${RED}ERRO: Node.js não encontrado. Instale Node.js 18+${NC}"
  exit 1
fi

# ── Docker ───────────────────────────────────────────────────────────────────
# Detecta docker compose (plugin v2) ou docker-compose (v1)
if docker compose version &>/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose &>/dev/null; then
  DC="docker-compose"
else
  echo -e "${RED}${BOLD}ERRO:${NC}${RED} Docker não encontrado ou Docker Compose não está disponível.${NC}"
  echo -e "  Instale o Docker Desktop em: ${CYAN}https://docs.docker.com/get-docker/${NC}"
  exit 1
fi

if ! docker info &>/dev/null 2>&1; then
  echo -e "${RED}${BOLD}ERRO:${NC}${RED} O daemon do Docker não está rodando. Inicie o Docker e tente novamente.${NC}"
  exit 1
fi

echo -e "${BLUE}[Docker]${NC} Iniciando container do banco de dados PostgreSQL..."
cd "$ROOT_DIR"
$DC up -d db

# Aguarda o banco estar pronto (healthcheck)
echo -e "${BLUE}[Docker]${NC} Aguardando PostgreSQL ficar pronto..."
ATTEMPTS=0
MAX_ATTEMPTS=30
until docker inspect --format='{{.State.Health.Status}}' filefinder-db 2>/dev/null | grep -q "healthy"; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ $ATTEMPTS -ge $MAX_ATTEMPTS ]; then
    echo -e "${RED}ERRO: PostgreSQL não ficou pronto após ${MAX_ATTEMPTS} tentativas.${NC}"
    echo -e "  Verifique os logs: ${YELLOW}docker logs filefinder-db${NC}"
    exit 1
  fi
  printf "."
  sleep 1
done
echo -e " ${GREEN}pronto!${NC}"

# ── Cleanup ao sair (Ctrl+C) ─────────────────────────────────────────────────
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo -e "\n${YELLOW}Encerrando servidores...${NC}"
  [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
  wait 2>/dev/null
  echo -e "${GREEN}Backend e frontend encerrados.${NC}"
  echo -e "${YELLOW}Dica:${NC} o banco de dados continua rodando em background."
  echo -e "  Para pará-lo: ${CYAN}docker compose stop db${NC}"
  echo -e "  Para removê-lo: ${CYAN}docker compose down${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── Backend (FastAPI) ─────────────────────────────────────────────────────────
VENV="$ROOT_DIR/a_backend/venv"

if [ ! -d "$VENV" ]; then
  echo -e "${BLUE}[Backend]${NC} Criando ambiente virtual Python..."
  python3 -m venv "$VENV"
fi

echo -e "${BLUE}[Backend]${NC} Instalando dependências Python..."
"$VENV/bin/pip" install -q --upgrade pip
"$VENV/bin/pip" install -q -r "$ROOT_DIR/a_backend/requirements.txt"

echo -e "${BLUE}[Backend]${NC} Iniciando FastAPI na porta ${BOLD}3001${NC}..."
cd "$ROOT_DIR/a_backend"
"$VENV/bin/uvicorn" main:app --reload --host 127.0.0.1 --port 3001 &
BACKEND_PID=$!
cd "$ROOT_DIR"

# Aguarda o backend subir
sleep 2

# ── Frontend (React/Vite) ─────────────────────────────────────────────────────
if [ ! -d "$ROOT_DIR/b_frontend/node_modules" ]; then
  echo -e "${CYAN}[Frontend]${NC} Instalando dependências npm..."
  cd "$ROOT_DIR/b_frontend" && npm install --silent && cd "$ROOT_DIR"
fi

echo -e "${CYAN}[Frontend]${NC} Iniciando React/Vite na porta ${BOLD}5173${NC}..."
cd "$ROOT_DIR/b_frontend"
npm run dev &
FRONTEND_PID=$!
cd "$ROOT_DIR"

# ── Pronto ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║      FileFinder rodando!             ║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Frontend: ${CYAN}http://localhost:5173${NC}    ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Backend:  ${CYAN}http://localhost:3001${NC}    ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Banco:    ${CYAN}localhost:5432${NC}          ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  Pressione ${BOLD}Ctrl+C${NC} para encerrar os servidores."
echo ""

wait
