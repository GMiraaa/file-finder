from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.services.chat_service import chat

router = APIRouter()


class ChatMessage(BaseModel):
    role: str     # "user" ou "model"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    attached_files: list[str] = []


@router.post("")
async def chat_endpoint(body: ChatRequest):
    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="Mensagem é obrigatória")

    try:
        history = [{"role": m.role, "content": m.content} for m in body.history]
        reply = await chat(body.message.strip(), history, body.attached_files or None)
        return {"reply": reply}
    except Exception as e:
        err = str(e)
        print(f"[chat] Erro: {e}")
        if "429" in err or "RESOURCE_EXHAUSTED" in err:
            raise HTTPException(
                status_code=429,
                detail="Limite de requisições da API atingido. Aguarde alguns segundos e tente novamente.",
            )
        raise HTTPException(status_code=500, detail=f"Erro no chat: {e}")
