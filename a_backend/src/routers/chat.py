from pathlib import Path
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.dependencies import get_current_user, get_user_data_dir
from src.database import User
from src.services.chat_service import chat, chat_stream, chat_file_edit

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


@router.post("/stream")
async def chat_stream_endpoint(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    """Endpoint SSE — envia chunks de texto à medida que o Gemini gera."""
    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="Mensagem é obrigatória")

    history = [{"role": m.role, "content": m.content} for m in body.history]

    async def event_generator():
        try:
            async for item in chat_stream(
                body.message.strip(), history,
                body.attached_files or None,
                data_dir, current_user.id,
            ):
                if isinstance(item, str):
                    yield f"data: {json.dumps({'chunk': item})}\n\n"
                elif isinstance(item, dict) and item.get("done"):
                    yield f"data: {json.dumps(item)}\n\n"
        except Exception as e:
            err = str(e)
            code = "rate_limit" if ("429" in err or "RESOURCE_EXHAUSTED" in err) else "error"
            yield f"data: {json.dumps({'error': code, 'message': err})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class FileEditRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    file_content: str
    filename: str


@router.post("/file-edit")
async def file_edit_endpoint(
    body: FileEditRequest,
    _auth=Depends(get_current_user),
):
    """Sugere edição de arquivo via IA com filtragem de conteúdo."""
    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="Mensagem é obrigatória")
    try:
        history = [{"role": m.role, "content": m.content} for m in body.history]
        result = await chat_file_edit(
            body.message.strip(), history, body.file_content, body.filename
        )
        return result
    except Exception as e:
        err = str(e)
        if "429" in err or "RESOURCE_EXHAUSTED" in err:
            raise HTTPException(status_code=429, detail="Limite de requisições da API atingido.")
        raise HTTPException(status_code=500, detail=f"Erro: {e}")
