from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.dependencies import get_current_user, get_user_data_dir
from src.database import User
from src.services.chat_service import chat

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    attached_files: list[str] = []


@router.post("")
async def chat_endpoint(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="Mensagem é obrigatória")

    try:
        history = [{"role": m.role, "content": m.content} for m in body.history]
        reply, action = await chat(
            body.message.strip(), history,
            body.attached_files or None,
            data_dir, current_user.id,
        )
        return {"reply": reply, "action": action}
    except Exception as e:
        err = str(e)
        print(f"[chat] Erro: {e}")
        if "429" in err or "RESOURCE_EXHAUSTED" in err:
            raise HTTPException(status_code=429, detail="Limite de requisições da API atingido. Aguarde alguns segundos e tente novamente.")
        raise HTTPException(status_code=500, detail=f"Erro no chat: {e}")
