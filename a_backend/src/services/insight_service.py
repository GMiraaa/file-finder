import asyncio
import json
import os
import re

from google import genai
from google.genai import types


async def generate_insight(files: list[dict], spaces_structure: dict) -> dict:
    """
    Analisa os arquivos recém-enviados e sugere organização em múltiplos grupos.
    Cada grupo pode conter um ou mais arquivos com destino em comum.
    """

    file_list = "\n".join(
        f"- {f['name']} ({(f.get('ext') or '').lstrip('.').upper() or '?'})"
        for f in files[:20]
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
        "Analise cada arquivo individualmente e agrupe-os por similaridade ou destino.\n"
        "Regras de agrupamento:\n"
        "  - Arquivos do mesmo tipo E com destino natural idêntico → mesmo grupo\n"
        "  - Arquivos de tipos diferentes ou com destinos diferentes → grupos separados\n"
        "  - Máximo de 1 ação por grupo (um destino por grupo)\n\n"
        "Para cada grupo você pode sugerir:\n"
        "  1. Colocar em espaço existente (sem criar pasta)\n"
        "  2. Colocar em pasta existente dentro de um espaço\n"
        "  3. Criar nova pasta dentro de espaço existente\n"
        "  4. Criar novo espaço\n\n"
        "Responda SOMENTE com JSON válido (sem markdown), neste formato exato:\n"
        '{"message":"Resumo geral em 1 frase","groups":['
        '{"message":"Descrição do grupo","suggested_space":"nome","is_new_space":false,'
        '"suggested_folder":"nome ou null","is_new_folder":false,"target_files":["a.ext"]}'
        "]}\n\n"
        "Regras do JSON:\n"
        "- message (raiz): frase curta tipo 'Analisei N arquivo(s) e preparei X sugestão(ões)'\n"
        "- groups: lista com 1 a N grupos — nunca retorne lista vazia\n"
        "- message (grupo): 1 frase amigável descrevendo o conteúdo/tipo do arquivo\n"
        "- suggested_space: nome do espaço (existente ou novo), nunca null\n"
        "- is_new_space: true somente se o espaço precisar ser criado\n"
        "- suggested_folder: subpasta dentro do espaço, ou null se raiz do espaço for suficiente\n"
        "- is_new_folder: true somente se a subpasta precisar ser criada\n"
        "- target_files: arquivos deste grupo (use exatamente os nomes da lista acima)"
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
            data = json.loads(match.group())
            # Normalize: ensure groups is present
            if "groups" not in data and "suggested_space" in data:
                # Old single-group format — wrap it
                data = {
                    "message": data.get("message", "Sugestão de organização pronta."),
                    "groups": [{
                        "message": data.get("message", ""),
                        "suggested_space": data["suggested_space"],
                        "is_new_space": data.get("is_new_space", False),
                        "suggested_folder": data.get("suggested_folder"),
                        "is_new_folder": data.get("is_new_folder", False),
                        "target_files": data.get("target_files", []),
                    }],
                }
            return data
        except json.JSONDecodeError:
            pass

    return {
        "message": "Arquivos enviados com sucesso!",
        "groups": [],
    }


async def analyze_all_organization(files: list[dict], spaces_structure: dict) -> dict:
    """
    Analisa TODOS os arquivos já armazenados e verifica se a organização atual
    faz sentido, sugerindo melhorias ou confirmando que tudo está organizado.
    """
    if not files:
        return {"message": "Nenhum arquivo encontrado para analisar.", "groups": [], "organized": True}

    file_list = "\n".join(
        f"- {f['name']} ({(f.get('ext') or '').lstrip('.').upper() or '?'})"
        + (f" — em: {f['folder']}" if f.get('folder') else " — sem espaço")
        for f in files[:60]
    )

    if spaces_structure:
        spaces_text = "\n".join(
            f"  - Espaço '{s}'" + (f": pastas → {', '.join(fs)}" if fs else ": sem subpastas")
            for s, fs in spaces_structure.items()
        )
        spaces_part = f"Estrutura de espaços atual:\n{spaces_text}"
    else:
        spaces_part = "Nenhum espaço criado ainda."

    prompt = (
        "Você é o FileFinder AI, especialista em organização de arquivos.\n"
        f"O usuário possui {len(files)} arquivo(s) armazenados com a seguinte distribuição:\n\n"
        f"{file_list}\n\n"
        f"{spaces_part}\n\n"
        "Sua tarefa: analisar se a organização atual está boa ou se há melhorias a sugerir.\n\n"
        "IMPORTANTE:\n"
        "- Se todos os arquivos já estão bem organizados e nos espaços/pastas corretos, "
        "retorne organized=true e NÃO retorne grupos.\n"
        "- Só sugira mover arquivos que claramente estariam melhor em outro lugar.\n"
        "- Não invente espaços desnecessários. Prefira espaços existentes.\n"
        "- Agrupe arquivos com destino natural idêntico.\n\n"
        "Responda SOMENTE com JSON válido (sem markdown), em um destes formatos:\n\n"
        "Se tudo está organizado:\n"
        '{"message":"Mensagem curta e positiva","organized":true,"groups":[]}\n\n'
        "Se há sugestões:\n"
        '{"message":"Resumo das sugestões em 1 frase","organized":false,"groups":['
        '{"message":"Descrição do grupo","suggested_space":"nome","is_new_space":false,'
        '"suggested_folder":"nome ou null","is_new_folder":false,"target_files":["a.ext"]}'
        "]}\n\n"
        "Regras:\n"
        "- message (raiz): frase curta explicando o resultado\n"
        "- groups: lista de sugestões (vazia se organized=true)\n"
        "- suggested_space: nunca null\n"
        "- target_files: use exatamente os nomes da lista acima"
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
            data = json.loads(match.group())
            data.setdefault("groups", [])
            data.setdefault("organized", len(data["groups"]) == 0)
            return data
        except json.JSONDecodeError:
            pass

    return {
        "message": "Não foi possível analisar a organização no momento.",
        "organized": True,
        "groups": [],
    }
