"""
FileFinder Agent — loop de function calling com Gemini 2.5 Flash.

Ferramentas: search_files, read_file, list_files,
             move_file, create_folder, rename_file,
             create_file, append_to_file, replace_file_content

Undo: cada ação destrutiva/modificadora é gravada com sua inversa.
O store de undo é mantido em memória por usuário (última execução apenas).
"""
from __future__ import annotations
import asyncio, json, logging
from pathlib import Path
from threading import Thread
from google.genai import types
from src.config import get_gemini_client
from src.services import file_service as fs
from src.services.vector_service import search as vector_search

log = logging.getLogger(__name__)

def _get_client():
    return get_gemini_client()


def _save_agent_log(user_id: int, message: str, result: str, actions: list[str]) -> int:
    """Persiste log no banco. Retorna o id do registro."""
    try:
        from src.database import SessionLocal, AgentLog
        db = SessionLocal()
        try:
            entry = AgentLog(
                user_id=user_id,
                message=message,
                result=result,
                actions=json.dumps(actions, ensure_ascii=False),
            )
            db.add(entry)
            db.commit()
            db.refresh(entry)
            return entry.id
        finally:
            db.close()
    except Exception as exc:
        log.warning("[agent_log] Falha ao salvar log: %s", exc)
        return -1


def _mark_log_undone(log_id: int) -> None:
    try:
        from src.database import SessionLocal, AgentLog
        db = SessionLocal()
        try:
            entry = db.query(AgentLog).filter(AgentLog.id == log_id).first()
            if entry:
                entry.was_undone = True
                db.commit()
        finally:
            db.close()
    except Exception as exc:
        log.warning("[agent_log] Falha ao marcar log como desfeito: %s", exc)

# ── Undo store (em memória, por usuário, última execução) ─────────────────────
_undo_store: dict[int, list[dict]] = {}
MAX_ITERATIONS = 12

# ── Ferramentas ───────────────────────────────────────────────────────────────
_TOOLS = types.Tool(function_declarations=[
    types.FunctionDeclaration(
        name="search_files",
        description="Busca arquivos cujo CONTEÚDO é relevante para a query (semântica). Use antes de agir em arquivos cujo nome exato você não sabe.",
        parameters=types.Schema(type=types.Type.OBJECT,
            properties={"query": types.Schema(type=types.Type.STRING)},
            required=["query"]),
    ),
    types.FunctionDeclaration(
        name="read_file",
        description="Lê o conteúdo completo de um arquivo de texto.",
        parameters=types.Schema(type=types.Type.OBJECT,
            properties={
                "filename": types.Schema(type=types.Type.STRING),
                "folder":   types.Schema(type=types.Type.STRING,
                    description="Caminho relativo, ex: 'Geral' ou 'Trabalho/Projetos'. Use '' para raiz."),
            },
            required=["filename", "folder"]),
    ),
    types.FunctionDeclaration(
        name="list_files",
        description="Lista arquivos e subpastas de uma pasta ou espaço.",
        parameters=types.Schema(type=types.Type.OBJECT,
            properties={"folder": types.Schema(type=types.Type.STRING,
                description="Use '' para listar todos os espaços.")},
            required=["folder"]),
    ),
    types.FunctionDeclaration(
        name="move_file",
        description="Move um arquivo de uma pasta para outra.",
        parameters=types.Schema(type=types.Type.OBJECT,
            properties={
                "filename":    types.Schema(type=types.Type.STRING),
                "from_folder": types.Schema(type=types.Type.STRING),
                "to_folder":   types.Schema(type=types.Type.STRING),
            },
            required=["filename", "from_folder", "to_folder"]),
    ),
    types.FunctionDeclaration(
        name="create_folder",
        description=(
            "Cria uma PASTA (subpasta) dentro de um espaço existente. "
            "SEMPRE use o formato 'Espaço/NomePasta', ex: 'Trabalho/Relatórios'. "
            "Use esta ferramenta quando o usuário pede para criar uma pasta/diretório. "
            "Para criar um novo ESPAÇO (categoria raiz), use apenas o nome sem '/'. "
            "Na dúvida, prefira criar pasta dentro do espaço existente."
        ),
        parameters=types.Schema(type=types.Type.OBJECT,
            properties={"path": types.Schema(type=types.Type.STRING)},
            required=["path"]),
    ),
    types.FunctionDeclaration(
        name="rename_file",
        description="Renomeia um arquivo mantendo-o na mesma pasta.",
        parameters=types.Schema(type=types.Type.OBJECT,
            properties={
                "filename": types.Schema(type=types.Type.STRING),
                "folder":   types.Schema(type=types.Type.STRING),
                "new_name": types.Schema(type=types.Type.STRING),
            },
            required=["filename", "folder", "new_name"]),
    ),
    types.FunctionDeclaration(
        name="create_file",
        description="Cria um novo arquivo de texto com o conteúdo fornecido.",
        parameters=types.Schema(type=types.Type.OBJECT,
            properties={
                "name":    types.Schema(type=types.Type.STRING,
                    description="Nome com extensão, ex: 'resumo.md'"),
                "folder":  types.Schema(type=types.Type.STRING),
                "content": types.Schema(type=types.Type.STRING),
            },
            required=["name", "folder", "content"]),
    ),
    types.FunctionDeclaration(
        name="append_to_file",
        description="Adiciona texto ao FINAL de um arquivo de texto existente.",
        parameters=types.Schema(type=types.Type.OBJECT,
            properties={
                "filename": types.Schema(type=types.Type.STRING),
                "folder":   types.Schema(type=types.Type.STRING),
                "content":  types.Schema(type=types.Type.STRING),
            },
            required=["filename", "folder", "content"]),
    ),
    types.FunctionDeclaration(
        name="replace_file_content",
        description="SUBSTITUI TODO o conteúdo de um arquivo de texto. Use apenas quando pedido explicitamente.",
        parameters=types.Schema(type=types.Type.OBJECT,
            properties={
                "filename": types.Schema(type=types.Type.STRING),
                "folder":   types.Schema(type=types.Type.STRING),
                "content":  types.Schema(type=types.Type.STRING),
            },
            required=["filename", "folder", "content"]),
    ),
])

_SYSTEM = """\
Você é o FileFinder Agent, um agente autônomo de gerenciamento de arquivos.

ESTRUTURA DE ORGANIZAÇÃO (hierarquia obrigatória de 2 níveis):
- Nível 1 — ESPAÇOS: categorias raiz (ex: 'Geral', 'Trabalho', 'Pessoal').
  Visíveis na barra lateral. Crie um espaço só quando o usuário pedir explicitamente
  uma nova categoria/área de trabalho.
- Nível 2 — PASTAS: subdiretórios dentro de um espaço (formato: 'Espaço/Pasta').
  Quando o usuário diz 'criar uma pasta', crie SEMPRE no nível 2 dentro do espaço
  relevante — nunca crie um novo espaço raiz para isso.
- Nível 3 — ARQUIVOS: ficam dentro de um espaço ou pasta. O campo 'folder' é o
  caminho completo até o diretório pai, ex: 'Trabalho' ou 'Trabalho/Relatórios'.

EXEMPLOS:
  'Crie uma pasta Contratos' → pergunte em qual espaço ou use o mais relevante
                                → create_folder('Juridico/Contratos')
  'Crie um espaço Finanças' → create_folder('Finanças')
  'Mova X para a pasta Atas' → descubra o espaço pai e use 'Espaço/Atas'

REGRAS:
1. Execute a tarefa do usuário de forma autônoma usando as ferramentas disponíveis.
2. Antes de agir em arquivos cujo nome exato você não sabe, use search_files.
3. Nunca invente nomes de arquivos — use apenas os retornados pelas ferramentas.
4. Ao final, descreva de forma clara e resumida tudo que foi feito.
5. Se não conseguir completar alguma parte, explique o motivo.
6. Seja eficiente: evite chamadas desnecessárias.
7. Responda sempre em português.
"""

# ── Executor de ferramentas ───────────────────────────────────────────────────
async def _exec_tool(
    name: str, args: dict,
    data_dir: Path, user_id: int,
    undo_log: list, action_log: list,
) -> str:
    try:
        if name == "search_files":
            chunks = await vector_search(args["query"], user_id, n_results=8)
            seen: dict[str, dict] = {}
            for c in chunks:
                key = f"{c['folder']}|{c['filename']}"
                if key not in seen:
                    seen[key] = c
            if not seen:
                return "Nenhum arquivo encontrado para essa busca."
            action_log.append(f"Buscou por \"{args['query']}\" → {len(seen)} resultado(s)")
            return "\n".join(
                f"• {v['filename']} (em: {v['folder'] or 'raiz'}) — {round(v['score']*100)}%"
                for v in seen.values()
            )

        if name == "read_file":
            fn, folder = args["filename"], args.get("folder", "")
            fp = (data_dir / folder / fn) if folder else (data_dir / fn)
            content = await fs.extract_content(fp)
            action_log.append(f"Leu o conteúdo de {fn}")
            return content or "[Arquivo sem conteúdo textual extraível]"

        if name == "list_files":
            folder = args.get("folder", "")
            result = await fs.get_items(folder, data_dir, user_id)
            parts = []
            if result["folders"]:
                parts.append("Pastas: " + ", ".join(f["name"] for f in result["folders"]))
            if result["files"]:
                parts.append("Arquivos: " + ", ".join(f["name"] for f in result["files"]))
            action_log.append(f"Listou {'raiz' if not folder else folder}")
            return "\n".join(parts) if parts else "Pasta vazia."

        if name == "move_file":
            fn, from_f, to_f = args["filename"], args["from_folder"], args["to_folder"]
            await fs.move_file(fn, from_f, to_f, data_dir)
            undo_log.append({"type": "move_file", "filename": fn, "from_folder": to_f, "to_folder": from_f})
            action_log.append(f"Moveu {fn}: {from_f or 'raiz'} → {to_f or 'raiz'}")
            return f"'{fn}' movido."

        if name == "create_folder":
            path = args["path"]
            await fs.create_folder(path, data_dir)
            undo_log.append({"type": "delete_folder", "path": path})
            action_log.append(f"Criou pasta {path}")
            return f"Pasta '{path}' criada."

        if name == "rename_file":
            fn, folder, new_name = args["filename"], args.get("folder", ""), args["new_name"]
            actual_new = new_name if Path(new_name).suffix else new_name + Path(fn).suffix
            await fs.rename_file(fn, folder, new_name, data_dir)
            undo_log.append({"type": "rename_file", "filename": actual_new, "folder": folder, "new_name": fn})
            action_log.append(f"Renomeou {fn} → {actual_new}")
            return f"'{fn}' renomeado para '{actual_new}'."

        if name == "create_file":
            n, folder, content = args["name"], args.get("folder", ""), args["content"]
            await fs.create_file(n, folder, content, data_dir, user_id)
            undo_log.append({"type": "delete_file", "filename": n, "folder": folder})
            action_log.append(f"Criou arquivo {n} em {folder or 'raiz'}")
            return f"Arquivo '{n}' criado."

        if name == "append_to_file":
            fn, folder, addition = args["filename"], args.get("folder", ""), args["content"]
            fp = (data_dir / folder / fn) if folder else (data_dir / fn)
            original = await fs.extract_content(fp) or ""
            await fs.write_file_content(fn, folder, original + "\n" + addition, data_dir)
            undo_log.append({"type": "restore_content", "filename": fn, "folder": folder, "content": original})
            action_log.append(f"Adicionou conteúdo ao final de {fn}")
            return f"Conteúdo adicionado ao final de '{fn}'."

        if name == "replace_file_content":
            fn, folder, new_content = args["filename"], args.get("folder", ""), args["content"]
            fp = (data_dir / folder / fn) if folder else (data_dir / fn)
            original = await fs.extract_content(fp) or ""
            await fs.write_file_content(fn, folder, new_content, data_dir)
            undo_log.append({"type": "restore_content", "filename": fn, "folder": folder, "content": original})
            action_log.append(f"Substituiu conteúdo de {fn}")
            return f"Conteúdo de '{fn}' substituído."

        return f"[Ferramenta desconhecida: {name}]"

    except Exception as exc:
        log.warning("[agent] Erro em %s: %s", name, exc)
        return f"Erro ao executar {name}: {exc}"


# ── Loop principal do agente ──────────────────────────────────────────────────
async def run_agent(message: str, data_dir: Path, user_id: int) -> dict:
    """Executa o agente e retorna {reply, actions, can_undo}."""
    undo_log:   list[dict] = []
    action_log: list[str]  = []
    final_text = "Tarefa concluída."

    contents = [{"role": "user", "parts": [{"text": message}]}]
    config = types.GenerateContentConfig(
        system_instruction=_SYSTEM,
        tools=[_TOOLS],
        temperature=0.2,
    )

    for _ in range(MAX_ITERATIONS):
        response = await asyncio.to_thread(
            _get_client().models.generate_content,
            model="gemini-2.5-flash",
            contents=contents,
            config=config,
        )
        parts = response.candidates[0].content.parts

        # Adiciona resposta do modelo ao histórico
        model_parts = []
        for p in parts:
            if hasattr(p, "text") and p.text:
                model_parts.append({"text": p.text})
            elif hasattr(p, "function_call") and p.function_call:
                model_parts.append({"function_call": {
                    "name": p.function_call.name,
                    "args": dict(p.function_call.args),
                }})
        contents.append({"role": "model", "parts": model_parts})

        tool_calls = [p.function_call for p in parts
                      if hasattr(p, "function_call") and p.function_call]

        if not tool_calls:
            final_text = " ".join(
                p.text for p in parts if hasattr(p, "text") and p.text
            ).strip() or final_text
            break

        # Executa ferramentas e devolve resultados
        results = []
        for fc in tool_calls:
            r = await _exec_tool(fc.name, dict(fc.args), data_dir, user_id, undo_log, action_log)
            results.append({"function_response": {"name": fc.name, "response": {"result": r}}})
        contents.append({"role": "user", "parts": results})

    if undo_log:
        _undo_store[user_id] = list(reversed(undo_log))

    # Persiste log de auditoria em background (não bloqueia a resposta)
    log_id = await asyncio.to_thread(_save_agent_log, user_id, message, final_text, action_log)
    if undo_log:
        _undo_store[user_id] = (list(reversed(undo_log)), log_id)  # guarda log_id junto

    return {"reply": final_text, "actions": action_log, "can_undo": bool(undo_log)}


# ── Streaming do agente ───────────────────────────────────────────────────────
async def run_agent_stream(message: str, data_dir: Path, user_id: int):
    """
    Async generator que emite eventos SSE durante a execução do agente:
      {"type":"action","text":"..."}  — ferramenta executada
      {"type":"chunk","text":"..."}   — trecho do texto final (streaming)
      {"type":"done","actions":[...],"can_undo":bool}  — finalizado
    """
    undo_log:   list[dict] = []
    action_log: list[str]  = []

    contents = [{"role": "user", "parts": [{"text": message}]}]
    config_tools = types.GenerateContentConfig(
        system_instruction=_SYSTEM, tools=[_TOOLS], temperature=0.2
    )
    config_final = types.GenerateContentConfig(
        system_instruction=_SYSTEM, temperature=0.2
    )

    for _ in range(MAX_ITERATIONS):
        response = await asyncio.to_thread(
            _get_client().models.generate_content,
            model="gemini-2.5-flash", contents=contents, config=config_tools,
        )
        parts = response.candidates[0].content.parts

        model_parts = []
        for p in parts:
            if hasattr(p, "text") and p.text:
                model_parts.append({"text": p.text})
            elif hasattr(p, "function_call") and p.function_call:
                model_parts.append({"function_call": {
                    "name": p.function_call.name,
                    "args": dict(p.function_call.args),
                }})
        contents.append({"role": "model", "parts": model_parts})

        tool_calls = [p.function_call for p in parts
                      if hasattr(p, "function_call") and p.function_call]

        if not tool_calls:
            # Resposta final — re-chama com streaming para emitir chunks
            stream_contents = contents[:-1]  # remove a última resposta não-streaming
            loop = asyncio.get_event_loop()
            q: asyncio.Queue = asyncio.Queue()

            def _run_stream():
                try:
                    for chunk in _get_client().models.generate_content_stream(
                        model="gemini-2.5-flash",
                        contents=stream_contents,
                        config=config_final,
                    ):
                        if chunk.text:
                            loop.call_soon_threadsafe(q.put_nowait, chunk.text)
                except Exception as exc:
                    loop.call_soon_threadsafe(q.put_nowait, exc)
                finally:
                    loop.call_soon_threadsafe(q.put_nowait, None)

            Thread(target=_run_stream, daemon=True).start()

            accumulated = ""
            while True:
                item = await q.get()
                if item is None:
                    break
                if isinstance(item, Exception):
                    # Fallback: usa a resposta não-streaming já obtida
                    fallback = " ".join(
                        p.text for p in parts if hasattr(p, "text") and p.text
                    ).strip()
                    yield {"type": "chunk", "text": fallback}
                    accumulated = fallback
                    break
                accumulated += item
                yield {"type": "chunk", "text": item}

            # Salva log e undo
            log_id = await asyncio.to_thread(
                _save_agent_log, user_id, message, accumulated, action_log
            )
            if undo_log:
                _undo_store[user_id] = (list(reversed(undo_log)), log_id)

            yield {"type": "done", "actions": action_log, "can_undo": bool(undo_log)}
            return

        # Executa ferramentas e emite evento de ação para cada uma
        results = []
        prev_len = len(action_log)
        for fc in tool_calls:
            r = await _exec_tool(fc.name, dict(fc.args), data_dir, user_id, undo_log, action_log)
            if len(action_log) > prev_len:
                yield {"type": "action", "text": action_log[-1]}
                prev_len = len(action_log)
            results.append({"function_response": {"name": fc.name, "response": {"result": r}}})
        contents.append({"role": "user", "parts": results})

    # Limite de iterações atingido
    log_id = await asyncio.to_thread(
        _save_agent_log, user_id, message, "Limite de iterações atingido.", action_log
    )
    if undo_log:
        _undo_store[user_id] = (list(reversed(undo_log)), log_id)
    yield {"type": "done", "actions": action_log, "can_undo": bool(undo_log)}


# ── Desfazer última execução ──────────────────────────────────────────────────
async def undo_last(data_dir: Path, user_id: int) -> dict:
    store_entry = _undo_store.pop(user_id, None)
    if not store_entry:
        return {"message": "Nenhuma ação para desfazer.", "undone": [], "errors": []}

    # Suporta o formato antigo (lista) e o novo (lista, log_id)
    if isinstance(store_entry, tuple):
        entries, log_id = store_entry
    else:
        entries, log_id = store_entry, -1

    undone, errors = [], []
    for e in entries:
        try:
            t = e["type"]
            if t == "move_file":
                await fs.move_file(e["filename"], e["from_folder"], e["to_folder"], data_dir)
                undone.append(f"Devolveu {e['filename']} para {e['to_folder'] or 'raiz'}")
            elif t == "delete_file":
                await fs.delete_file(e["filename"], e["folder"], data_dir)
                undone.append(f"Removeu {e['filename']} (criado pelo agente)")
            elif t == "delete_folder":
                await fs.delete_folder(e["path"], data_dir)
                undone.append(f"Removeu pasta {e['path']} (criada pelo agente)")
            elif t == "rename_file":
                await fs.rename_file(e["filename"], e["folder"], e["new_name"], data_dir)
                undone.append(f"Renomeou {e['filename']} de volta para {e['new_name']}")
            elif t == "restore_content":
                await fs.write_file_content(e["filename"], e["folder"], e["content"], data_dir)
                undone.append(f"Restaurou conteúdo original de {e['filename']}")
        except Exception as exc:
            errors.append(f"Falha em {e.get('type','?')}: {exc}")

    if log_id > 0:
        await asyncio.to_thread(_mark_log_undone, log_id)

    msg = f"{len(undone)} ação(ões) desfeita(s)."
    if errors:
        msg += f" {len(errors)} erro(s): " + "; ".join(errors)
    return {"message": msg, "undone": undone, "errors": errors}
