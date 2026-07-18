from pathlib import Path
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.dependencies import get_current_user, get_user_data_dir
from src.database import User
from src.services.agent_service import run_agent, run_agent_stream, undo_last

router = APIRouter()


class AgentRequest(BaseModel):
    message: str


@router.post("")
async def agent_run(
    body: AgentRequest,
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="Mensagem vazia")
    try:
        result = await run_agent(body.message.strip(), data_dir, current_user.id)
        return result
    except Exception as e:
        err = str(e)
        if "429" in err or "RESOURCE_EXHAUSTED" in err:
            raise HTTPException(status_code=429, detail="Rate limit atingido. Aguarde e tente novamente.")
        raise HTTPException(status_code=500, detail=err)


@router.post("/stream")
async def agent_stream(
    body: AgentRequest,
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    """Endpoint SSE — emite eventos action/chunk/done em tempo real."""
    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="Mensagem vazia")

    async def event_generator():
        try:
            async for event in run_agent_stream(
                body.message.strip(), data_dir, current_user.id
            ):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            err = str(e)
            code = "rate_limit" if ("429" in err or "RESOURCE_EXHAUSTED" in err) else "error"
            yield f"data: {json.dumps({'type': 'error', 'code': code, 'message': err})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/undo")
async def agent_undo(
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    try:
        result = await undo_last(data_dir, current_user.id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
