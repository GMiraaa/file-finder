import asyncio
import json
import os
import re

from google import genai
from google.genai import types


async def generate_insight(files: list[dict], existing_folders: list[str]) -> dict:
    """Analyzes just-uploaded files and suggests folder organization."""

    file_list = "\n".join(
        f"- {f['name']} ({(f.get('ext') or '').lstrip('.').upper() or '?'})"
        for f in files[:10]
    )
    folders_part = (
        f"Pastas já existentes: {', '.join(existing_folders)}"
        if existing_folders
        else "Nenhuma pasta criada ainda."
    )

    prompt = (
        "Você é o FileFinder AI, um assistente de organização de arquivos.\n"
        f"O usuário acabou de fazer upload de {len(files)} arquivo(s):\n"
        f"{file_list}\n\n"
        f"{folders_part}\n\n"
        "Com base nos nomes e tipos dos arquivos, sugira organização em pasta.\n"
        "Responda SOMENTE com JSON válido (sem markdown), neste formato exato:\n"
        '{"message":"Vi que você...","suggested_folder":"nome ou null","is_new_folder":true,"target_files":["a.ext"]}\n\n'
        "Regras:\n"
        "- message: amigável, 1-2 frases, começa com 'Vi que você'\n"
        "- suggested_folder: null se arquivos forem muito variados para agrupar\n"
        "- is_new_folder: false se já existir uma pasta adequada na lista acima\n"
        "- target_files: apenas os arquivos que fazem sentido mover para essa pasta"
    )

    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

    def _call():
        return client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.15),
        )

    response = await asyncio.to_thread(_call)
    text = (response.text or "").strip()

    # Extract JSON robustly
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return {
        "message": text[:300] if text else "Arquivos enviados com sucesso!",
        "suggested_folder": None,
        "is_new_folder": False,
        "target_files": [],
    }
