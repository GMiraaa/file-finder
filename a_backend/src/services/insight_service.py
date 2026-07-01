import asyncio
import json
import os
import re

from google import genai
from google.genai import types


async def generate_insight(files: list[dict], spaces_structure: dict) -> dict:
    """
    Analisa os arquivos recém-enviados e sugere organização por espaço e/ou pasta.

    spaces_structure: {nome_do_espaco: [nome_da_pasta, ...]}
    """

    file_list = "\n".join(
        f"- {f['name']} ({(f.get('ext') or '').lstrip('.').upper() or '?'})"
        for f in files[:10]
    )

    if spaces_structure:
        spaces_text = "\n".join(
            f"  - Espaço '{s}'" + (f": pastas → {', '.join(fs)}" if fs else ": sem subpastas")
            for s, fs in spaces_structure.items()
        )
        spaces_part = f"Espaços existentes:\n{spaces_text}"
    else:
        spaces_part = "Nenhum espaço criado ainda."

    prompt = (
        "Você é o FileFinder AI, um assistente de organização de arquivos.\n"
        f"O usuário acabou de fazer upload de {len(files)} arquivo(s):\n"
        f"{file_list}\n\n"
        f"{spaces_part}\n\n"
        "Com base nos nomes e tipos dos arquivos, sugira onde organizá-los.\n"
        "Você pode sugerir:\n"
        "  1. Colocar em um espaço existente (sem criar pasta)\n"
        "  2. Colocar em uma pasta existente dentro de um espaço\n"
        "  3. Criar uma nova pasta dentro de um espaço existente\n"
        "  4. Criar um novo espaço (se nenhum existente for adequado)\n\n"
        "Responda SOMENTE com JSON válido (sem markdown), neste formato exato:\n"
        '{"message":"Vi que você...","suggested_space":"nome ou null","is_new_space":false,"suggested_folder":"nome ou null","is_new_folder":false,"target_files":["a.ext"]}\n\n'
        "Regras:\n"
        "- message: amigável, 1-2 frases, começa com 'Vi que você'\n"
        "- suggested_space: nome do espaço sugerido (existente ou novo), ou null se os arquivos forem muito variados\n"
        "- is_new_space: true somente se o espaço precisar ser criado\n"
        "- suggested_folder: nome da subpasta dentro do espaço, ou null se o espaço raiz for suficiente\n"
        "- is_new_folder: true somente se a subpasta precisar ser criada\n"
        "- target_files: arquivos que fazem sentido mover para esse destino"
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

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return {
        "message": text[:300] if text else "Arquivos enviados com sucesso!",
        "suggested_space": None,
        "is_new_space": False,
        "suggested_folder": None,
        "is_new_folder": False,
        "target_files": [],
    }
