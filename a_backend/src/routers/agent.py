from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.dependencies import get_current_user, get_user_data_dir
from src.database import User
from src.services.agent_service import run_agent, undo_last

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
