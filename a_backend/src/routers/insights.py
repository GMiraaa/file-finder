from fastapi import APIRouter, Depends, HTTPException
from pathlib import Path
from pydantic import BaseModel

from src.dependencies import get_current_user, get_user_data_dir
from src.database import User
from src.services.insight_service import generate_insight, analyze_all_organization
from src.services.file_service import get_all_files_flat, get_space_structure

router = APIRouter()


class InsightRequest(BaseModel):
    files: list[dict]
    spaces_structure: dict = {}


@router.post("")
async def get_insights(
    body: InsightRequest,
    _auth=Depends(get_user_data_dir),
):
    if not body.files:
        raise HTTPException(status_code=400, detail="Nenhum arquivo fornecido")
    try:
        return await generate_insight(body.files, body.spaces_structure)
    except Exception as e:
        err = str(e)
        if "429" in err or "RESOURCE_EXHAUSTED" in err:
            raise HTTPException(status_code=429, detail="Rate limit atingido")
        raise HTTPException(status_code=500, detail=err)


@router.post("/analyze-all")
async def analyze_all_endpoint(
    data_dir: Path = Depends(get_user_data_dir),
    current_user: User = Depends(get_current_user),
):
    """Analisa TODOS os arquivos do usuário e sugere reorganização se necessário."""
    try:
        files = await get_all_files_flat(data_dir, current_user.id)
        structure = await get_space_structure(data_dir)
        return await analyze_all_organization(files, structure)
    except Exception as e:
        err = str(e)
        if "429" in err or "RESOURCE_EXHAUSTED" in err:
            raise HTTPException(status_code=429, detail="Rate limit atingido")
        raise HTTPException(status_code=500, detail=err)
