from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.services.insight_service import generate_insight

router = APIRouter()


class InsightRequest(BaseModel):
    files: list[dict]
    existing_folders: list[str] = []


@router.post("")
async def get_insights(body: InsightRequest):
    if not body.files:
        raise HTTPException(status_code=400, detail="Nenhum arquivo fornecido")
    try:
        return await generate_insight(body.files, body.existing_folders)
    except Exception as e:
        err = str(e)
        if "429" in err or "RESOURCE_EXHAUSTED" in err:
            raise HTTPException(status_code=429, detail="Rate limit atingido")
        raise HTTPException(status_code=500, detail=err)
