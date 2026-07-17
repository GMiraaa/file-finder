import { useState, useRef, useEffect } from 'react';
import {
  X, Download, ExternalLink, FolderInput, Pencil, Check, SquarePen,
  Send, Bot, Loader2, Sparkles, MessageSquare, Paperclip, AlertTriangle,
  FilePlus, CheckCheck, Undo2, FolderOpen, Folder, ChevronRight, Cpu,
  RotateCcw, ChevronDown, ChevronUp,
} from 'lucide-react';
import { getFileTypeInfo, formatFileSize, getFileUrl, isEditableFile } from '../utils/helpers';
import MoveToSpaceModal from './MoveToSpaceModal';
import FileEditorModal from './FileEditorModal';
import { sendMessage, fileEditChat, writeFileContent, runAgent, undoAgent } from '../services/api';

const EDIT_KEYWORDS = /\b(adicionar?|adicione|adiciona|append|escrever?|escreva|inclui[r]?|inclua|inserir?|insira|colocar?|coloque|acrescentar?|acrescente|completar?|complete|substituir?|substitua|reescrever?|reescreva)\b/i;

// ── Árvore de arquivos ──────────────────────────────────────────────────────
function FileTree({ allFiles, currentFile, onSelect }) {
  const [openSpaces, setOpenSpaces] = useState({});

  // Agrupa arquivos por espaço e subpasta
  const tree = {};
  for (const f of allFiles || []) {
    const parts = (f.folder || '').split('/');
    const space = parts[0] || 'Raiz';
    const sub   = parts[1] || '';
    const key   = sub ? `${space}/${sub}` : space;
    if (!tree[key]) tree[key] = { label: key, space, sub, files: [] };
    tree[key].files.push(f);
  }

  const isCurrent = (f) => f.name === currentFile.name && (f.folder || '') === (currentFile.folder || '');

  return (
    <div className="flex-1 overflow-y-auto">
      {Object.values(tree).map((group) => {
        const isOpen = openSpaces[group.key] !== false;
        return (
          <div key={group.label}>
            {/* Cabeçalho do grupo */}
            <button
              onClick={() => setOpenSpaces((p) => ({ ...p, [group.label]: !isOpen }))}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {group.sub
                ? <><FolderOpen className="w-3.5 h-3.5 text-indigo-400" /><span className="text-gray-400 dark:text-gray-500">{group.space}</span><span className="mx-1 text-gray-300">/</span><span>{group.sub}</span></>
                : <><FolderOpen className="w-3.5 h-3.5 text-indigo-500" /><span>{group.space}</span></>}
              <span className="ml-auto text-[10px] font-normal text-gray-400">{group.files.length}</span>
            </button>

            {/* Arquivos do grupo */}
            {isOpen && group.files.map((f) => {
              const { icon: FIcon, color } = getFileTypeInfo(f.name);
              const active = isCurrent(f);
              return (
                <button
                  key={`${f.folder||''}-${f.name}`}
                  onClick={() => onSelect(f)}
                  className={`w-full flex items-center gap-2 px-5 py-1.5 text-xs text-left transition-colors ${
                    active
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <FIcon className={`w-3.5 h-3.5 flex-shrink-0 ${color}`} />
                  <span className="truncate flex-1">{f.name}</span>
                  {active && <ChevronRight className="w-3 h-3 text-indigo-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Mini agente ───────────────────────────────────────────────────────────────
function AgentMiniPanel({ currentFile }) {
  const [input, setInput]       = useState('');
  const [running, setRunning]   = useState(false);
  const [result, setResult]     = useState(null); // {reply, actions, can_undo}
  const [undoing, setUndoing]   = useState(false);
  const [showActions, setShowActions] = useState(false);

  const handleRun = async () => {
    const text = input.trim();
    if (!text || running) return;
    setRunning(true);
    setResult(null);
    const location = currentFile.folder || 'Geral';
    const prompt = `Sobre o arquivo "${currentFile.name}" (em ${location}): ${text}`;
    try {
      const { data } = await runAgent(prompt);
      setResult(data);
      setShowActions(true);
    } catch (err) {
      const status = err?.response?.status;
      setResult({ reply: status === 429 ? 'Rate limit atingido. Aguarde.' : 'Erro ao executar o agente.', actions: [], can_undo: false });
    } finally {
      setRunning(false);
    }
  };

  const handleUndo = async () => {
    setUndoing(true);
    try {
      const { data } = await undoAgent();
      setResult((prev) => ({ ...prev, can_undo: false, undone: data.undone }));
    } catch { /* silent */ } finally { setUndoing(false); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center gap-1.5">
        <Cpu className="w-3.5 h-3.5 text-violet-500" />
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Agente</span>
        <span className="text-[10px] text-gray-400 truncate ml-1">— {currentFile.name}</span>
      </div>

      {/* Resposta */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!result && !running && (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center mt-4">
            Descreva uma tarefa para o agente executar neste arquivo ou no seu espaço.
          </p>
        )}
        {running && (
          <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Agente executando…
          </div>
        )}
        {result && (
          <>
            <p className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed">{result.reply}</p>

            {result.actions?.length > 0 && (
              <div className="rounded-xl border border-violet-200 dark:border-violet-700/40 bg-violet-50 dark:bg-violet-900/10 overflow-hidden">
                <button
                  onClick={() => setShowActions((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300"
                >
                  <span>{result.actions.length} ação(es)</span>
                  {showActions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showActions && (
                  <div className="px-3 pb-2 space-y-0.5">
                    {result.actions.map((a, i) => (
                      <p key={i} className="text-[11px] text-violet-600 dark:text-violet-400">{a}</p>
                    ))}
                    {result.undone?.map((u, i) => (
                      <p key={i} className="text-[11px] text-gray-500">{u}</p>
                    ))}
                  </div>
                )}
                {result.can_undo && (
                  <div className="px-3 pb-2">
                    <button
                      onClick={handleUndo}
                      disabled={undoing}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 transition-colors disabled:opacity-50"
                    >
                      {undoing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                      {undoing ? 'Desfazendo…' : 'Desfazer'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-700 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRun(); } }}
          disabled={running}
          placeholder="Descreva uma tarefa…"
          rows={2}
          className="flex-1 resize-none text-xs bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-2 text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none focus:ring-1 focus:ring-violet-400 focus:bg-white dark:focus:bg-gray-600 disabled:opacity-50"
        />
        <button
          onClick={handleRun}
          disabled={!input.trim() || running}
          className="p-2.5 bg-violet-600 hover:bg-violet-700 rounded-xl text-white disabled:opacity-40 flex-shrink-0"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
function MiniChat({ file, canEdit, onContentUpdated }) {  const INIT = {
    role: 'model',
    content: `Arquivo **${file.name}** anexado. Faça perguntas sobre o conteúdo${canEdit ? ' ou peça para adicionar/modificar texto' : ''}.`,
  };
  const [messages, setMessages]           = useState([INIT]);
  const [input, setInput]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [attachedExtra, setAttachedExtra] = useState([]);
  const [pendingEdit, setPendingEdit]     = useState(null);
  const [applying, setApplying]           = useState(false);
  const [fileContent, setFileContent]     = useState(null);
  const [fileLoading, setFileLoading]     = useState(false);
  const [undoStack, setUndoStack]         = useState([]);  // pilha de versões anteriores
  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, pendingEdit]);

  // Carrega o conteúdo do arquivo para edição
  useEffect(() => {
    if (!canEdit) return;
    setFileLoading(true);
    fetch(getFileUrl(file), { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(); return r.text(); })
      .then((t) => setFileContent(t))
      .catch(() => setFileContent(''))
      .finally(() => setFileLoading(false));
  }, [file, canEdit]);

  const historyForApi = () =>
    messages.map((m) => ({ role: m.role, content: m.content }));

  const isEditRequest = (text) => canEdit && EDIT_KEYWORDS.test(text);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const history = historyForApi();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    try {
      if (canEdit) {
        // Sempre usa a rota de edição quando o arquivo é editável
        // O modelo decide se é pergunta (action=null) ou edição (action=append|prepend|replace)
        const { data } = await fileEditChat(text, history, fileContent ?? '', file.name);
        if (data.blocked) {
          setMessages((prev) => [
            ...prev,
            { role: 'model', content: `⚠️ Solicitação bloqueada: ${data.blocked}` },
          ]);
        } else if (data.action) {
          // Sugestão de edição — aguarda confirmação do usuário
          setMessages((prev) => [...prev, { role: 'model', content: data.reply }]);
          setPendingEdit(data);
        } else {
          // Apenas resposta textual (pergunta/análise)
          setMessages((prev) => [...prev, { role: 'model', content: data.reply || '...' }]);
        }
      } else {
        // Arquivo não editável — Q&A normal
        const attached = [file.name, ...attachedExtra.map((f) => f.name)];
        const { data } = await sendMessage(text, history, attached);
        setMessages((prev) => [...prev, { role: 'model', content: data.reply || '...' }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'model', content: 'Erro ao obter resposta. Tente novamente.' }]);
    } finally {
      setLoading(false);
    }
  };

  const applyEdit = async () => {
    if (!pendingEdit || fileContent === null) return;
    setApplying(true);
    try {
      let newContent = fileContent;
      if (pendingEdit.action === 'replace') {
        newContent = pendingEdit.content;
      } else if (pendingEdit.action === 'prepend') {
        newContent = pendingEdit.content + '\n' + fileContent;
      } else {
        newContent = fileContent.endsWith('\n')
          ? fileContent + pendingEdit.content
          : fileContent + '\n' + pendingEdit.content;
      }
      await writeFileContent(file.name, file.folder || '', newContent);
      setUndoStack((prev) => [...prev, fileContent]);   // guarda versão anterior
      setFileContent(newContent);
      setPendingEdit(null);
      onContentUpdated?.(newContent);
      setMessages((prev) => [...prev, { role: 'model', content: '✅ Alteração aplicada ao arquivo com sucesso!' }]);
    } catch (err) {
      const detail = err?.response?.data?.detail || '';
      setMessages((prev) => [...prev, {
        role: 'model',
        content: `❌ Erro ao salvar: ${detail || 'Verifique se o arquivo ainda existe e tente novamente.'}`,
      }]);
    } finally {
      setApplying(false);
    }
  };

  const handleUndo = async () => {
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    setApplying(true);
    try {
      await writeFileContent(file.name, file.folder || '', prev);
      setUndoStack((s) => s.slice(0, -1));
      setFileContent(prev);
      onContentUpdated?.(prev);
      setMessages((m) => [...m, { role: 'model', content: '↩️ Alteração desfeita com sucesso.' }]);
    } catch {
      setMessages((m) => [...m, { role: 'model', content: '❌ Erro ao desfazer. Tente novamente.' }]);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">FileFinder AI</p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{file.name}</p>
        </div>
        {canEdit && undoStack.length > 0 && (
          <button
            onClick={handleUndo}
            disabled={applying}
            title={`Desfazer última edição (${undoStack.length} disponível)`}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Desfazer
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {msg.role === 'model' && (
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0 mb-0.5">
                <Bot className="w-3.5 h-3.5 text-blue-600" />
              </div>
            )}
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-sm px-3 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
            </div>
          </div>
        )}

        {/* Confirmação de edição pendente */}
        {pendingEdit && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3 text-xs">
            <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1.5 flex items-center gap-1.5">
              <FilePlus className="w-3.5 h-3.5" />
              Alteração proposta — {pendingEdit.action === 'replace' ? 'substituir arquivo' : pendingEdit.action === 'prepend' ? 'adicionar ao início' : 'adicionar ao final'}
            </p>
            <pre className="text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 rounded-lg p-2 overflow-auto max-h-28 whitespace-pre-wrap break-words mb-2.5">
              {pendingEdit.content.slice(0, 400)}{pendingEdit.content.length > 400 ? '…' : ''}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={applyEdit}
                disabled={applying || fileContent === null}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-[11px] font-semibold disabled:opacity-50"
              >
                {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                {fileContent === null ? 'Carregando…' : 'Aplicar'}
              </button>
              <button
                onClick={() => setPendingEdit(null)}
                disabled={applying}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-[11px]"
              >
                <X className="w-3 h-3" />
                Descartar
              </button>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Arquivos extras anexados */}
      {attachedExtra.length > 0 && (
        <div className="px-3 pb-1 flex flex-wrap gap-1">
          {attachedExtra.map((f) => {
            const { icon: FIcon, color: fc } = getFileTypeInfo(f.name);
            return (
              <span key={f.name} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-[10px] text-gray-600 dark:text-gray-300">
                <FIcon className={`w-3 h-3 ${fc}`} />
                {f.name}
                <button onClick={() => setAttachedExtra((p) => p.filter((x) => x.name !== f.name))}>
                  <X className="w-2.5 h-2.5 text-gray-400 hover:text-red-500 transition-colors" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 flex-shrink-0">
        <div className="flex items-end gap-2 bg-gray-100 dark:bg-gray-800 rounded-2xl px-3 py-2 border border-gray-200 dark:border-gray-700 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400/30 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={canEdit ? 'Pergunte ou peça para modificar o arquivo…' : 'Pergunte sobre este arquivo…'}
            className="flex-1 bg-transparent outline-none resize-none text-xs text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 max-h-24"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-7 h-7 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-3 h-3 text-white" />
          </button>
        </div>
        {canEdit && (
          <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1 text-center">
            Pergunte sobre o conteúdo ou peça alterações — a IA decide como responder
          </p>
        )}
      </div>
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────
const TEXT_EXTS = new Set([
  'txt','md','json','csv','js','ts','jsx','tsx','py','java','c','cpp',
  'h','css','scss','html','xml','yaml','yml','sh','sql','env','ini',
  'toml','conf','log','rb','php','go','rs','kt',
]);
export default function PreviewChatModal({ file, onClose, onMoveFileTo, onRenameFile, allFiles = [] }) {
  const [currentFile, setCurrentFile] = useState(file);
  const fileUrl = getFileUrl(currentFile);
  const ext     = (currentFile.ext || '').replace('.', '').toLowerCase();
  const isImage = ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext);
  const isPdf   = ext === 'pdf';
  const isText  = TEXT_EXTS.has(ext);
  const { icon: Icon, color, bg } = getFileTypeInfo(currentFile.name);
  const canEdit = isEditableFile(currentFile.name);

  // 'chat' | 'files' | 'agent'
  const [rightPanel, setRightPanel] = useState('chat');

  const [textContent, setTextContent]   = useState(null);
  const [textLoading, setTextLoading]   = useState(false);
  const [moveOpen, setMoveOpen]         = useState(false);
  const [editOpen, setEditOpen]         = useState(false);
  const [editing, setEditing]           = useState(false);
  const [nameValue, setNameValue]       = useState(currentFile.name);
  const [renaming, setRenaming]         = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    setTextContent(null);
    setNameValue(currentFile.name);
    if (isText) {
      setTextLoading(true);
      fetch(fileUrl, { cache: 'no-store' })
        .then((r) => r.text())
        .then((t) => setTextContent(t))
        .catch(() => setTextContent('Erro ao carregar conteúdo.'))
        .finally(() => setTextLoading(false));
    }
  }, [fileUrl, isText, currentFile.name]);

  // Fechar com Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const startEditing = () => {
    if (!onRenameFile) return;
    setNameValue(currentFile.name);
    setEditing(true);
    setTimeout(() => { nameInputRef.current?.focus(); nameInputRef.current?.select(); }, 0);
  };

  const cancelEditing = () => { setEditing(false); setNameValue(currentFile.name); };

  const confirmRename = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === currentFile.name) { cancelEditing(); return; }
    setRenaming(true);
    await onRenameFile(currentFile.name, currentFile.folder || '', trimmed);
    setRenaming(false);
    setEditing(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex overflow-hidden">

        {/* ── Painel esquerdo: preview ── */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-gray-100 dark:border-gray-700">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />

            {/* Nome editável */}
            {editing ? (
              <div className="flex-1 flex items-center gap-1.5 min-w-0">
                <input
                  ref={nameInputRef}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') cancelEditing(); }}
                  disabled={renaming}
                  className="flex-1 text-sm font-semibold bg-transparent border-b-2 border-blue-500 outline-none text-gray-800 dark:text-gray-100 min-w-0"
                />
                <button onClick={confirmRename} disabled={renaming} className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg">
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                </button>
                <button onClick={cancelEditing} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ) : (
              <div
                className={`flex-1 flex items-center gap-1.5 min-w-0 group/name ${onRenameFile ? 'cursor-text' : ''}`}
                onClick={startEditing}
              >
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{currentFile.name}</p>
                {onRenameFile && (
                  <Pencil className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover/name:opacity-100 transition-opacity flex-shrink-0" />
                )}
              </div>
            )}

            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{formatFileSize(currentFile.size)}</span>
            {canEdit && (
              <button onClick={() => setEditOpen(true)} className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl" title="Editar">
                <SquarePen className="w-4 h-4 text-blue-500" />
              </button>
            )}
            {onMoveFileTo && (
              <button onClick={() => setMoveOpen(true)} className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl" title="Mover">
                <FolderInput className="w-4 h-4 text-blue-500" />
              </button>
            )}
            <a href={fileUrl} download={currentFile.name} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl" title="Baixar">
              <Download className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </a>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl" title="Abrir em nova aba">
              <ExternalLink className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </a>
            {/* Fechar */}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
              <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Conteúdo do arquivo */}
          <div className="flex-1 overflow-auto p-4 min-h-0">
            {isImage && (
              <img src={fileUrl} alt={currentFile.name} className="max-w-full max-h-full mx-auto rounded-xl object-contain" />
            )}
            {isPdf && (
              <iframe src={fileUrl} title={currentFile.name} className="w-full h-full min-h-[60vh] rounded-xl border border-gray-200 dark:border-gray-700" />
            )}
            {isText && (
              textLoading
                ? <p className="text-sm text-gray-400 text-center mt-8">Carregando...</p>
                : <pre className="text-xs text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 rounded-xl p-4 overflow-auto whitespace-pre-wrap break-words h-full">{textContent}</pre>
            )}
            {!isImage && !isPdf && !isText && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className={`w-20 h-20 rounded-2xl ${bg} dark:bg-gray-700 flex items-center justify-center mb-4`}>
                  <Icon className={`w-10 h-10 ${color}`} />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Preview não disponível para este tipo de arquivo</p>
                <a href={fileUrl} download={currentFile.name} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition-colors">
                  <Download className="w-4 h-4" />
                  Baixar arquivo
                </a>
              </div>
            )}
          </div>
        </div>

        {/* ── Painel direito: Chat / Arquivos / Agente ── */}
        <div className="w-[340px] flex-shrink-0 flex flex-col min-h-0 border-l border-gray-100 dark:border-gray-700">
          {/* Abas */}
          <div className="flex border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            {[
              { id: 'chat',   label: 'Chat',     Icon: MessageSquare },
              { id: 'files',  label: 'Arquivos', Icon: Folder },
              { id: 'agent',  label: 'Agente',   Icon: Cpu },
            ].map(({ id, label, Icon: TabIcon }) => (
              <button
                key={id}
                onClick={() => setRightPanel(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                  rightPanel === id
                    ? id === 'agent'
                      ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                      : 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Conteúdo da aba */}
          {rightPanel === 'chat' && (
            <MiniChat
              file={currentFile}
              canEdit={isText && !isImage && !isPdf}
              onContentUpdated={(newContent) => setTextContent(newContent)}
            />
          )}
          {rightPanel === 'files' && (
            <FileTree
              allFiles={allFiles}
              currentFile={currentFile}
              onSelect={(f) => setCurrentFile(f)}
            />
          )}
          {rightPanel === 'agent' && (
            <AgentMiniPanel currentFile={currentFile} />
          )}
        </div>
      </div>

      {moveOpen && onMoveFileTo && (
        <MoveToSpaceModal
          fileName={currentFile.name}
          currentFolder={currentFile.folder || ''}
          onMove={(dest) => { onMoveFileTo(currentFile.name, currentFile.folder || '', dest); setMoveOpen(false); onClose(); }}
          onClose={() => setMoveOpen(false)}
        />
      )}
      {editOpen && canEdit && (
        <FileEditorModal file={currentFile} onClose={() => setEditOpen(false)} onSaved={() => setEditOpen(false)} />
      )}
    </div>
  );
}
