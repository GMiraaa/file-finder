import json
import re
import asyncio
from pathlib import Path
from google.genai import types
from threading import Thread

from src.config import get_gemini_client
from src.services.file_service import (
    get_all_files_flat, get_files_with_content_by_names,
)
from src.services.vector_service import search as vector_search
from src.utils.helpers import format_size


def _format_location(folder: str) -> str:
    """Formata a localização do arquivo como 'Espaço › Pasta' ou apenas 'Espaço'."""
    if not folder:
        return ""
    parts = folder.split("/")
    if len(parts) == 1:
        return f"\n  Localização: {parts[0]}"
    return f"\n  Localização: {parts[0]} › {'/'.join(parts[1:])}"

_ORGANIZAR_RULES = """\

ORGANIZAÇÃO DE ARQUIVOS:
Se o usuário pedir para MOVER, ORGANIZAR ou REDISTRIBUIR arquivos, responda \
EXCLUSIVAMENTE com uma linha no formato abaixo (sem texto antes ou depois):
AÇÃO:{"reply":"<mensagem para o usuário>","moves":[{"filename":"<nome exato>","from_folder":"<valor do campo from_folder do arquivo>","to_folder":"<destino>"}],"creates":[]}

Regras da ação:
- "reply": confirmação amigável do que será feito (1-2 frases).
- "moves": use os nomes e from_folder EXATAMENTE como listados abaixo.
- "to_folder": caminho do destino ("" = raiz, "Espaço", "Espaço/Subpasta").
- "creates": pastas a criar antes de mover, ex: [{"path":"NovoEspaço"}]. Deixe [] se o destino já existe.
- Não invente nomes de arquivos — use apenas os listados abaixo."""

_SYSTEM_PROMPT = """\
Você é o FileFinder AI, um assistente EXCLUSIVAMENTE especializado nos arquivos \
que o usuário fez upload nesta plataforma.

REGRAS ABSOLUTAS — siga sem exceções:
1. Responda SOMENTE perguntas relacionadas aos arquivos listados abaixo \
(conteúdo, resumo, comparação, localização de informações dentro dos arquivos).
2. Se o usuário perguntar qualquer coisa fora do escopo dos arquivos \
(clima, esportes, receitas, matemática, programação em geral, piadas, notícias, etc.), \
responda exatamente: "Só posso responder sobre os arquivos que você fez upload. \
Tem alguma dúvida sobre eles?"
3. Cite sempre o nome do arquivo quando referenciar uma informação específica.
4. Sempre informe a localização do arquivo (espaço e pasta) no formato: \
"📍 Localização: Espaço › Pasta" (ou apenas "Espaço" se não houver subpasta).
5. Responda sempre em português, de forma clara e concisa.
6. Nunca invente informações que não estejam nos arquivos.
{organizar_rules}

CATÁLOGO DE ARQUIVOS (todos os arquivos disponíveis):
{catalog}

TRECHOS RELEVANTES RECUPERADOS PARA ESTA PERGUNTA:
{rag_context}"""

_SYSTEM_PROMPT_FOCUSED = """\
Você é o FileFinder AI. O usuário anexou arquivos específicos para esta conversa.

REGRAS:
1. Responda com base EXCLUSIVAMENTE no conteúdo dos arquivos anexados abaixo.
2. Cite o nome do arquivo ao referenciar informações específicas.
3. Sempre informe a localização do arquivo (espaço e pasta) no formato: \
"📍 Localização: Espaço › Pasta" (ou apenas "Espaço" se não houver subpasta).
4. Responda sempre em português, de forma clara e concisa.
5. Nunca invente informações que não estejam nos arquivos.
{organizar_rules}

ARQUIVOS ANEXADOS PELO USUÁRIO:
{file_context}"""


def _build_file_context(files_with_content: list[dict]) -> str:
    lines = []
    for f in files_with_content:
        folder_raw = f.get("folder") or ""
        line = (
            f"• {f['name']} ({f.get('ext', '?')}, {format_size(f['size'])})"
            f"\n  from_folder: \"{folder_raw}\""
            + _format_location(folder_raw)
        )
        if f.get("content"):
            line += f"\n  Conteúdo: {f['content'][:1500]}"
        else:
            line += "\n  [Arquivo binário — sem conteúdo extraível]"
        lines.append(line)
    return "\n\n".join(lines)


def _parse_response(text: str) -> tuple[str, dict | None]:
    """Detecta resposta de ação AÇÃO:{...} e separa reply + action."""
    text = text.strip()
    if text.startswith("AÇÃO:"):
        json_str = text[len("AÇÃO:"):]
        json_str = re.sub(r"^```[a-z]*\n?", "", json_str.strip())
        json_str = re.sub(r"\n?```$", "", json_str.strip())
        try:
            data = json.loads(json_str)
            reply = data.get("reply", "Ação de organização preparada.")
            action = {
                "moves":   data.get("moves", []),
                "creates": data.get("creates", []),
            }
            return reply, action
        except (json.JSONDecodeError, KeyError):
            pass
    return text, None


# ── Helper: constrói system prompt + contents ─────────────────────────────────

_MAX_HISTORY = 40  # últimas 20 trocas (20 user + 20 model)

async def _build_chat_context(
    message: str,
    history: list[dict],
    attached_files: list[str] | None,
    data_dir: Path,
    user_id: int,
):
    """Retorna (system, contents, None) ou (None, mensagem_de_erro, None) se sem arquivos."""
    if attached_files:
        files_with_content = await get_files_with_content_by_names(attached_files, data_dir, user_id)
        if not files_with_content:
            return None, "Nenhum dos arquivos anexados foi encontrado.", None
        file_context = _build_file_context(files_with_content)
        system = _SYSTEM_PROMPT_FOCUSED.format(
            file_context=file_context,
            organizar_rules=_ORGANIZAR_RULES,
        )
    else:
        all_files = await get_all_files_flat(data_dir, user_id)
        if not all_files:
            return None, (
                "Você ainda não fez upload de nenhum arquivo. "
                "Faça upload primeiro para que eu possa ajudá-lo!"
            ), None

        catalog_lines = []
        for f in all_files:
            folder_raw = f.get("folder") or ""
            loc = _format_location(folder_raw).replace("\n  ", " ").strip()
            catalog_lines.append(
                f"• {f['name']} ({f.get('ext','?')}, {format_size(f['size'])})"
                + (f" — {loc}" if loc else "")
                + f"\n  from_folder: \"{folder_raw}\""
            )
        catalog = "\n".join(catalog_lines)

        chunks = await vector_search(message, user_id, n_results=8)
        if chunks:
            rag_parts = []
            for c in chunks:
                loc = _format_location(c["folder"]).replace("\n  ", " ").strip()
                header = f"[{c['filename']}{' — ' + loc if loc else ''}]"
                rag_parts.append(f"{header}\n{c['content']}")
            rag_context = "\n\n---\n\n".join(rag_parts)
        else:
            rag_context = (
                "Nenhum trecho relevante encontrado no índice para esta pergunta.\n"
                "O arquivo pode não ter conteúdo textual extraível, ou ainda não foi indexado."
            )

        system = _SYSTEM_PROMPT.format(
            catalog=catalog,
            rag_context=rag_context,
            organizar_rules=_ORGANIZAR_RULES,
        )

    # Trunca histórico às últimas 20 trocas
    truncated = history[-_MAX_HISTORY:]
    contents = [
        {"role": msg["role"], "parts": [{"text": msg["content"]}]}
        for msg in truncated
    ]
    contents.append({"role": "user", "parts": [{"text": message}]})
    return system, contents, None


async def chat(message: str, history: list[dict], attached_files: list[str] | None,
               data_dir: Path, user_id: int) -> tuple[str, dict | None]:
    system, contents, _ = await _build_chat_context(message, history, attached_files, data_dir, user_id)
    if system is None:
        return contents, None  # contents é a mensagem de erro

    config = types.GenerateContentConfig(system_instruction=system, temperature=0.4)

    response = await asyncio.to_thread(
        get_gemini_client().models.generate_content,
        model="gemini-2.5-flash",
        contents=contents,
        config=config,
    )

    return _parse_response(response.text.strip())


# ── Streaming do chat ─────────────────────────────────────────────────────────

async def chat_stream(
    message: str,
    history: list[dict],
    attached_files: list[str] | None,
    data_dir,
    user_id: int,
):
    """
    Versão streaming de chat().
    Yields str chunks, depois {"done": True, "reply": str, "action": dict|None}.
    """
    system, contents, _ = await _build_chat_context(message, history, attached_files, data_dir, user_id)
    if system is None:  # sem arquivos
        yield {"done": True, "reply": contents, "action": None}
        return

    config = types.GenerateContentConfig(system_instruction=system, temperature=0.4)
    loop = asyncio.get_event_loop()
    q: asyncio.Queue = asyncio.Queue()

    def _run():
        try:
            for chunk in get_gemini_client().models.generate_content_stream(
                model="gemini-2.5-flash", contents=contents, config=config
            ):
                if chunk.text:
                    loop.call_soon_threadsafe(q.put_nowait, chunk.text)
        except Exception as exc:
            loop.call_soon_threadsafe(q.put_nowait, exc)
        finally:
            loop.call_soon_threadsafe(q.put_nowait, None)

    Thread(target=_run, daemon=True).start()

    accumulated = ""
    while True:
        item = await q.get()
        if item is None:
            break
        if isinstance(item, Exception):
            raise item
        accumulated += item
        yield item  # string chunk

    reply, action = _parse_response(accumulated.strip())
    yield {"done": True, "reply": reply, "action": action}

_EDIT_BLOCKED_TOPICS = (
    "conteúdo sexual, pornográfico ou erótico, "
    "discurso de ódio, violência, racismo ou discriminação, "
    "instruções para atividades ilegais, malware ou exploits, "
    "manipulação psicológica ou desinformação intencional"
)

_EDIT_SYSTEM = f"""\
Você é um assistente que responde perguntas e edita documentos de texto.

REGRAS DE SEGURANÇA (absolutas):
1. NUNCA produza: {_EDIT_BLOCKED_TOPICS}.
2. Se a instrução violar qualquer regra acima, responda APENAS com:
   BLOQUEADO: <motivo em uma frase curta>

COMPORTAMENTO:
- Se o usuário fizer uma PERGUNTA sobre o arquivo (resumo, busca, explicação, etc.):
  Responda com JSON: {{"reply":"<resposta completa>","action":null,"content":null}}

- Se o usuário pedir para MODIFICAR, FORMATAR, ADICIONAR, REESCREVER ou alterar o arquivo:
  Responda com JSON: {{"reply":"<confirmação curta do que foi feito>","action":"<append|prepend|replace>","content":"<texto gerado>"}}

AÇÕES:
- "append"  : adiciona ao final do arquivo
- "prepend" : adiciona ao início do arquivo
- "replace" : substitui TODO o conteúdo (use apenas se pedido explicitamente)

REGRAS DO JSON:
- Responda SEMPRE com JSON válido (sem markdown, sem texto fora do JSON)
- "content" deve conter apenas o trecho novo (exceto quando action=replace)
- Responda sempre em português, salvo se o arquivo estiver em outro idioma
"""


async def chat_file_edit(
    message: str,
    history: list[dict],
    file_content: str,
    filename: str,
) -> dict:
    """
    Gera uma sugestão de edição de arquivo com base na instrução do usuário.
    Retorna: {"reply": str, "action": str, "content": str} ou {"blocked": str}.
    """
    context = (
        f"Arquivo: {filename}\n"
        f"Conteúdo atual:\n---\n{file_content[:4000]}\n---\n"
    )

    contents = [
        {"role": msg["role"], "parts": [{"text": msg["content"]}]}
        for msg in history
    ]
    contents.append({"role": "user", "parts": [{"text": f"{context}\nInstrução: {message}"}]})

    config = types.GenerateContentConfig(
        system_instruction=_EDIT_SYSTEM,
        temperature=0.3,
    )

    response = await asyncio.to_thread(
        get_gemini_client().models.generate_content,
        model="gemini-2.5-flash",
        contents=contents,
        config=config,
    )

    text = (response.text or "").strip()

    if text.startswith("BLOQUEADO:"):
        return {"blocked": text[len("BLOQUEADO:"):].strip()}

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            return {
                "reply":   data.get("reply", ""),
                "action":  data.get("action"),   # pode ser null
                "content": data.get("content"),
            }
        except json.JSONDecodeError:
            pass

    # Fallback: resposta simples sem edição
    return {"reply": text, "action": None, "content": None}
