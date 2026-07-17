import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, Loader2, Sparkles, Eye, Download,
  Lightbulb, Check, X, Paperclip, Search, Folder, Wand2,
  Cpu, RotateCcw, ChevronDown, ChevronUp,
} from 'lucide-react';
import { sendMessage, analyzeAllFiles, runAgent, undoAgent } from '../services/api';
import { getFileTypeInfo, getFileUrl } from '../utils/helpers';
import FilePreviewModal from './FilePreviewModal';

const INITIAL_MESSAGE = {
  role: 'model',
  content:
    'Olá! Sou o FileFinder AI. Posso responder perguntas sobre o conteúdo dos seus arquivos — resumos, comparações, busca de informações específicas e muito mais. Como posso ajudar?',
};

function detectFiles(text, allFiles) {
  if (!allFiles || !allFiles.length) return [];
  return allFiles.filter((f) => text.includes(f.name));
}

function FileChatCard({ file, onPreview }) {
  const { icon: Icon, color } = getFileTypeInfo(file.name);
  const fileUrl = getFileUrl(file);
  return (
    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-2.5 py-2">
      <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
      <span className="flex-1 text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{file.name}</span>
      <button
        onClick={() => onPreview(file)}
        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
        title="Preview"
      >
        <Eye className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
      </button>
      <a
        href={fileUrl}
        download={file.name}
        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
        title="Baixar"
        onClick={(e) => e.stopPropagation()}
      >
        <Download className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
      </a>
    </div>
  );
}

function AgentResultCard({ result, msgIndex, onUndo }) {
  const [expanded, setExpanded] = useState(false);
  const [undoing, setUndoing]   = useState(false);

  const handleUndo = async () => {
    setUndoing(true);
    await onUndo(msgIndex);
    setUndoing(false);
  };

  return (
    <div className="mt-2 rounded-xl border border-violet-200 dark:border-violet-700/40 bg-violet-50 dark:bg-violet-900/10 overflow-hidden">
      {/* Ações executadas */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/20 transition-colors"
      >
        <span>{result.actions.length} ação(ões) executada(s)</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-1">
          {result.actions.map((a, i) => (
            <p key={i} className="text-xs text-violet-600 dark:text-violet-400">{a}</p>
          ))}
          {result.undone && result.undone.length > 0 && (
            <div className="mt-2 pt-2 border-t border-violet-200 dark:border-violet-700/40">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Desfeito:</p>
              {result.undone.map((u, i) => (
                <p key={i} className="text-xs text-gray-500 dark:text-gray-400">{u}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Botão desfazer */}
      {result.can_undo && (
        <div className="px-3 pb-2.5 pt-1 border-t border-violet-200 dark:border-violet-700/40">
          <button
            onClick={handleUndo}
            disabled={undoing}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-700/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {undoing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            {undoing ? 'Desfazendo…' : 'Desfazer todas as ações'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ChatPanel({ allFiles, pendingInsight, onApplyInsight, onApplyMoves, autoAttachFile }) {
  const hasFiles = allFiles && allFiles.length > 0;
  const [messages, setMessages]       = useState([INITIAL_MESSAGE]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  // Modo agente
  const [agentMode, setAgentMode]   = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);

  // Anexar arquivos e pastas
  const [attachedFiles, setAttachedFiles]     = useState([]);
  const [attachedFolders, setAttachedFolders] = useState([]);
  const [showPicker, setShowPicker]           = useState(false);
  const [pickerSearch, setPickerSearch]       = useState('');
  const [pickerTab, setPickerTab]             = useState('files'); // 'files' | 'folders'
  const pickerRef = useRef(null);

  const lastInsightId = useRef(null);
  const bottomRef     = useRef(null);
  const textareaRef   = useRef(null);

  // Análise completa de organização
  const [analyzing, setAnalyzing] = useState(false);

  // Auto-anexar arquivo ao abrir preview
  useEffect(() => {
    if (!autoAttachFile) {
      // Ao fechar o preview, remove todos os arquivos que foram auto-anexados
      setAttachedFiles([]);
      return;
    }
    setAttachedFiles((prev) =>
      prev.some((f) => f.name === autoAttachFile.name) ? prev : [...prev, autoAttachFile]
    );
  }, [autoAttachFile]);

  const handleAnalyzeAll = async () => {
    if (analyzing || loading) return;
    setAnalyzing(true);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: '🔍 Analise a organização de todos os meus arquivos e sugira melhorias.' },
    ]);
    try {
      const { data } = await analyzeAllFiles();
      if (data.organized || !data.groups?.length) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'model',
            content: data.message || 'Seus arquivos já estão bem organizados! Não encontrei sugestões de melhoria.',
          },
        ]);
      } else {
        const groups = (data.groups || []).map((g) => ({ ...g, status: 'pending' }));
        setMessages((prev) => [
          ...prev,
          { role: 'model', content: data.message, insight: { ...data, groups } },
        ]);
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || '';
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: detail.includes('429') || detail.includes('Rate')
            ? 'Limite de requisições atingido. Aguarde um momento e tente novamente.'
            : 'Não foi possível analisar a organização no momento. Tente novamente em breve.',
        },
      ]);
    } finally {
      setAnalyzing(false);
    }
  };

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Fechar picker ao clicar fora
  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false);
        setPickerSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPicker]);

  // Injeta insight como mensagem especial
  useEffect(() => {
    if (!pendingInsight || pendingInsight.id === lastInsightId.current) return;
    lastInsightId.current = pendingInsight.id;
    // Garante que cada group tenha status individual
    const groups = (pendingInsight.groups || []).map((g) =>
      g.status ? g : { ...g, status: 'pending' }
    );
    setMessages((prev) => [
      ...prev,
      { role: 'model', content: pendingInsight.message, insight: { ...pendingInsight, groups } },
    ]);
  }, [pendingInsight]);

  const updateGroupStatus = (msgIndex, groupIndex, status) => {
    setMessages((prev) =>
      prev.map((m, i) => {
        if (i !== msgIndex || !m.insight?.groups) return m;
        const groups = m.insight.groups.map((g, gi) =>
          gi === groupIndex ? { ...g, status } : g
        );
        return { ...m, insight: { ...m.insight, groups } };
      })
    );
  };

  const applyGroup = async (group, msgIndex, groupIndex) => {
    updateGroupStatus(msgIndex, groupIndex, 'applying');
    const destinationPath = group.suggested_folder
      ? `${group.suggested_space}/${group.suggested_folder}`
      : group.suggested_space;
    const creates = [];
    if (group.is_new_space) creates.push({ path: group.suggested_space });
    if (group.suggested_folder && group.is_new_folder) creates.push({ path: destinationPath });
    const moves = (group.target_files || []).map((filename) => {
      const fileData = (allFiles || []).find((f) => f.name === filename);
      return { filename, from_folder: fileData?.folder || '', to_folder: destinationPath };
    });
    const result = await onApplyMoves(moves, creates);
    updateGroupStatus(msgIndex, groupIndex, result?.success !== false ? 'applied' : 'pending');
  };

  const updateInsightStatus = (msgIndex, status) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIndex && m.insight ? { ...m, insight: { ...m.insight, status } } : m
      )
    );
  };

  const updateActionStatus = (msgIndex, status) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIndex && m.action ? { ...m, action: { ...m.action, status } } : m
      )
    );
  };

  const handleApplyAction = async (action, msgIndex) => {
    updateActionStatus(msgIndex, 'applying');
    const result = await onApplyMoves(action.moves || [], action.creates || []);
    updateActionStatus(msgIndex, result?.success !== false ? 'applied' : 'pending');
  };

  const handleApplyInsight = async (insight, msgIndex) => {
    updateInsightStatus(msgIndex, 'applying');
    const result = await onApplyInsight(insight);
    updateInsightStatus(msgIndex, result?.success !== false ? 'applied' : 'pending');
  };

  // Arquivo picker helpers
  const toggleFile = (file) => {
    setAttachedFiles((prev) =>
      prev.some((f) => f.name === file.name)
        ? prev.filter((f) => f.name !== file.name)
        : [...prev, file]
    );
  };
  const isAttached = (file) => attachedFiles.some((f) => f.name === file.name);
  const removeAttached = (filename) =>
    setAttachedFiles((prev) => prev.filter((f) => f.name !== filename));

  const filteredPickerFiles = (allFiles || []).filter((f) =>
    pickerSearch ? f.name.toLowerCase().includes(pickerSearch.toLowerCase()) : true
  );

  // Pasta picker helpers
  const allFoldersList = (() => {
    const spaces = new Set();
    const subfolderSet = new Set();
    const hasRoot = (allFiles || []).some((f) => !f.folder);
    for (const f of allFiles || []) {
      if (!f.folder) continue;
      const parts = f.folder.split('/');
      spaces.add(parts[0]);
      if (parts.length > 1) subfolderSet.add(f.folder);
    }
    const result = [];
    if (hasRoot) result.push({ label: 'Sem espaço (raiz)', path: '', indent: false });
    for (const space of [...spaces].sort()) {
      result.push({ label: space, path: space, indent: false });
      for (const sub of [...subfolderSet].filter((s) => s.startsWith(space + '/')).sort()) {
        result.push({ label: sub.split('/').slice(1).join('/'), path: sub, indent: true });
      }
    }
    return result;
  })();

  const toggleFolder = (path) => {
    setAttachedFolders((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };
  const isFolderAttached = (path) => attachedFolders.includes(path);
  const removeAttachedFolder = (path) =>
    setAttachedFolders((prev) => prev.filter((p) => p !== path));

  const filteredPickerFolders = allFoldersList.filter(({ label, path }) =>
    pickerSearch
      ? label.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        path.toLowerCase().includes(pickerSearch.toLowerCase())
      : true
  );

  const totalAttached = attachedFiles.length + attachedFolders.length;

  // Input handlers
  const handleInputChange = (e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const resetTextarea = () => {
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading || agentRunning) return;

    setInput('');
    resetTextarea();
    textareaRef.current?.focus();

    // ── Modo Agente ───────────────────────────────────────────────────────
    if (agentMode) {
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      setAgentRunning(true);
      try {
        const { data } = await runAgent(text);
        setMessages((prev) => [...prev, {
          role: 'model',
          content: data.reply,
          agentResult: { actions: data.actions || [], can_undo: data.can_undo },
        }]);
      } catch (err) {
        const status = err?.response?.status;
        const msg = status === 429
          ? 'Limite de requisições atingido. Aguarde alguns segundos.'
          : 'Erro ao executar o agente. Tente novamente.';
        setMessages((prev) => [...prev, { role: 'model', content: msg }]);
      } finally {
        setAgentRunning(false);
      }
      return;
    }

    // ── Modo Chat normal ──────────────────────────────────────────────────
    const snapshot        = [...attachedFiles];
    const folderSnapshot  = [...attachedFolders];
    setAttachedFiles([]);
    setAttachedFolders([]);
    setShowPicker(false);

    const userMsg = { role: 'user', content: text, attachedFiles: snapshot, attachedFolders: folderSnapshot };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      const history = next.slice(1, -1).map(({ role, content }) => ({ role, content }));
      const folderFileNames = (allFiles || [])
        .filter((f) => folderSnapshot.some((fp) => {
          const ff = f.folder || '';
          return ff === fp || ff.startsWith(fp + '/');
        }))
        .map((f) => f.name);
      const attachedNames = [...new Set([...snapshot.map((f) => f.name), ...folderFileNames])];
      const { data } = await sendMessage(text, history, attachedNames.length ? attachedNames : undefined);
      const reply = data.reply;
      const action = data.action ? { ...data.action, status: 'pending' } : null;
      const detectedFiles = detectFiles(reply, allFiles);
      setMessages((prev) => [...prev, { role: 'model', content: reply, detectedFiles, action }]);
    } catch (err) {
      const status = err?.response?.status;
      const msg = status === 429
        ? 'Limite de requisições atingido. Aguarde alguns segundos e tente novamente.'
        : 'Ocorreu um erro ao contatar a IA. Tente novamente.';
      setMessages((prev) => [...prev, { role: 'model', content: msg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleUndoAgent = async (msgIndex) => {
    try {
      const { data } = await undoAgent();
      // Marca o botão como usado
      setMessages((prev) => prev.map((m, i) =>
        i === msgIndex && m.agentResult
          ? { ...m, agentResult: { ...m.agentResult, can_undo: false, undone: data.undone } }
          : m
      ));
    } catch {
      // silently fail
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <aside className="w-[360px] flex-shrink-0 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-900">
        {/* Cabeçalho */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex-shrink-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
            agentMode ? 'bg-violet-600' : 'bg-blue-600'
          }`}>
            {agentMode ? <Cpu className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">
              {agentMode ? 'FileFinder Agent' : 'FileFinder AI'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {agentMode ? 'Age autonomamente nos seus arquivos' : 'Pergunte sobre seus arquivos'}
            </p>
          </div>
          {/* Toggle modo agente */}
          <button
            onClick={() => setAgentMode((v) => !v)}
            title={agentMode ? 'Voltar ao modo chat' : 'Ativar modo agente'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors border flex-shrink-0 ${
              agentMode
                ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-600'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-violet-400 hover:text-violet-600'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Agente
          </button>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {msg.role === 'model' && (
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5 ${
                  msg.insight ? 'bg-amber-100 dark:bg-amber-900/40'
                  : msg.agentResult ? 'bg-violet-100 dark:bg-violet-900/40'
                  : 'bg-blue-100 dark:bg-blue-900/40'
                }`}>
                  {msg.insight
                    ? <Lightbulb className="w-4 h-4 text-amber-500" />
                    : msg.agentResult
                      ? <Cpu className="w-4 h-4 text-violet-600" />
                      : <Bot className="w-4 h-4 text-blue-600" />}
                </div>
              )}

              <div className="max-w-[82%] flex flex-col gap-1.5">
                {/* Badge action */}
                {msg.action && (
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider ml-0.5">
                    📂 Organização de arquivos
                  </span>
                )}

                {/* Badge insight */}
                {msg.insight && (
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider ml-0.5">
                    💡 Insight de organização
                  </span>
                )}

                {/* Balão */}
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : msg.insight
                      ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-gray-800 dark:text-gray-100 rounded-bl-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm'
                  }`}
                >
                  {msg.content}

                  {/* Arquivos/pastas anexados visíveis dentro da mensagem do usuário */}
                  {msg.role === 'user' && ((msg.attachedFiles?.length ?? 0) + (msg.attachedFolders?.length ?? 0)) > 0 && (
                    <div className="mt-2 flex flex-col gap-1 border-t border-white/20 pt-2">
                      {(msg.attachedFolders || []).map((path) => (
                        <span key={`folder-${path}`} className="flex items-center gap-1.5 text-[11px] text-white/80">
                          <Folder className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{path || 'Raiz'}</span>
                        </span>
                      ))}
                      {(msg.attachedFiles || []).map((f) => (
                        <span key={f.name} className="flex items-center gap-1.5 text-[11px] text-white/80">
                          <Paperclip className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Botões de ação de organização (chat) */}
                {msg.action && msg.action.moves?.length > 0 && (() => {
                  const { moves, creates, status } = msg.action;
                  return (
                    <div className="flex flex-col gap-1.5 mt-0.5">
                      {/* Lista resumida de movimentações */}
                      {status !== 'applied' && status !== 'dismissed' && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 flex flex-col gap-0.5">
                          {moves.slice(0, 5).map((m, idx) => (
                            <span key={idx} className="truncate">
                              <span className="font-medium text-gray-700 dark:text-gray-300">{m.filename}</span>
                              {' → '}
                              <span className="text-blue-600 dark:text-blue-400">{m.to_folder || 'raiz'}</span>
                            </span>
                          ))}
                          {moves.length > 5 && (
                            <span className="text-gray-400">+{moves.length - 5} mais...</span>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        {status === 'applied' ? (
                          <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium px-1 py-1">
                            <Check className="w-3.5 h-3.5" />
                            Organizado!
                          </span>
                        ) : status === 'dismissed' ? (
                          <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-600 italic px-1 py-1">
                            <X className="w-3 h-3" />
                            Ação cancelada
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleApplyAction(msg.action, i)}
                              disabled={status === 'applying'}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-full font-medium transition-colors"
                            >
                              {status === 'applying'
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Check className="w-3 h-3" />}
                              Aplicar ({moves.length} arquivo{moves.length !== 1 ? 's' : ''})
                            </button>
                            <button
                              onClick={() => updateActionStatus(i, 'dismissed')}
                              className="flex items-center gap-1 text-xs px-3 py-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                            >
                              <X className="w-3 h-3" />
                              Cancelar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Cards de sugestão por grupo (novo formato) */}
                {msg.insight?.groups?.length > 0 && (
                  <div className="flex flex-col gap-2 mt-0.5">
                    {msg.insight.groups.map((group, gi) => {
                      const dest = group.suggested_folder
                        ? `${group.suggested_space} / ${group.suggested_folder}`
                        : group.suggested_space;
                      const isNew = group.is_new_space || group.is_new_folder;
                      return (
                        <div
                          key={gi}
                          className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl px-3 py-2.5 flex flex-col gap-1.5"
                        >
                          {/* Arquivos e destino */}
                          <div className="flex items-start gap-1.5">
                            <span className="text-[11px] text-gray-600 dark:text-gray-300 flex-1 leading-snug">
                              <span className="font-medium text-gray-800 dark:text-gray-100">
                                {group.target_files.join(', ')}
                              </span>
                              {' → '}
                              <span className="text-amber-700 dark:text-amber-400 font-medium">{dest}</span>
                              {isNew && (
                                <span className="ml-1 text-[10px] text-amber-500 dark:text-amber-500 font-semibold uppercase">novo</span>
                              )}
                            </span>
                          </div>
                          {/* Mensagem descritiva */}
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{group.message}</p>
                          {/* Botões */}
                          {group.status === 'applied' ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                              <Check className="w-3.5 h-3.5" /> Aplicado!
                            </span>
                          ) : group.status === 'dismissed' ? (
                            <span className="flex items-center gap-1 text-xs text-gray-400 italic">
                              <X className="w-3 h-3" /> Ignorado
                            </span>
                          ) : (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => applyGroup(group, i, gi)}
                                disabled={group.status === 'applying'}
                                className="flex items-center gap-1 text-xs px-2.5 py-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-full font-medium transition-colors"
                              >
                                {group.status === 'applying'
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <Check className="w-3 h-3" />}
                                Aplicar
                              </button>
                              <button
                                onClick={() => updateGroupStatus(i, gi, 'dismissed')}
                                className="flex items-center gap-1 text-xs px-2.5 py-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                              >
                                <X className="w-3 h-3" /> Ignorar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Botão de ação do insight (formato antigo — fallback) */}
                {msg.insight && !msg.insight.groups && msg.insight.suggested_space && (() => {
                  const { suggested_space, is_new_space, suggested_folder, is_new_folder } = msg.insight;
                  let label;
                  if (is_new_space && !suggested_folder) {
                    label = `Criar sessão "${suggested_space}" e mover`;
                  } else if (!suggested_folder) {
                    label = `Mover para sessão "${suggested_space}"`;
                  } else if (is_new_folder) {
                    label = `Criar "${suggested_folder}" em "${suggested_space}"`;
                  } else {
                    label = `Mover para "${suggested_folder}" em "${suggested_space}"`;
                  }
                  return (
                    <div className="flex gap-2 flex-wrap mt-0.5">
                      {msg.insight.status === 'applied' ? (
                        <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium px-1 py-1">
                          <Check className="w-3.5 h-3.5" /> Organizado!
                        </span>
                      ) : msg.insight.status === 'dismissed' ? (
                        <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-600 italic px-1 py-1">
                          <X className="w-3 h-3" /> Sugestão recusada
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleApplyInsight(msg.insight, i)}
                            disabled={msg.insight.status === 'applying'}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-full font-medium transition-colors"
                          >
                            {msg.insight.status === 'applying'
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Check className="w-3 h-3" />}
                            {label}
                          </button>
                          <button
                            onClick={() => updateInsightStatus(i, 'dismissed')}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                          >
                            <X className="w-3 h-3" /> Ignorar
                          </button>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Cards de arquivos detectados */}
                {msg.detectedFiles && msg.detectedFiles.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-0.5">
                    {msg.detectedFiles.map((file) => (
                      <FileChatCard key={file.name} file={file} onPreview={setPreviewFile} />
                    ))}
                  </div>
                )}

                {/* Resultado do agente */}
                {msg.agentResult && (
                  <AgentResultCard
                    result={msg.agentResult}
                    msgIndex={i}
                    onUndo={handleUndoAgent}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Indicador de digitação — chat */}
          {loading && (
            <div className="flex items-end gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-blue-600" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}

          {/* Indicador de execução — agente */}
          {agentRunning && (
            <div className="flex items-end gap-2">
              <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0">
                <Cpu className="w-4 h-4 text-violet-600" />
              </div>
              <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700/40 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Agente executando…
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Área de input */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 relative" ref={pickerRef}>
          {!hasFiles && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-700/40 rounded-xl px-3 py-2 mb-2.5">
              Faça upload de arquivos para ativar o chat com IA.
            </p>
          )}

          {/* File picker popover */}
          {hasFiles && (
            <div className={`absolute bottom-full left-3 right-3 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-20
              transition-all duration-150 origin-bottom
              ${showPicker ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-97 translate-y-2 pointer-events-none'}`}
            >
              {/* Barra de busca */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder={pickerTab === 'files' ? 'Filtrar arquivos...' : 'Filtrar pastas...'}
                  className="flex-1 text-xs bg-transparent outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
                />
                {pickerSearch && (
                  <button onClick={() => setPickerSearch('')}>
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Abas Arquivos / Pastas */}
              <div className="flex border-b border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => setPickerTab('files')}
                  className={`flex-1 text-xs py-1.5 font-medium transition-colors ${
                    pickerTab === 'files'
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  Arquivos
                </button>
                <button
                  onClick={() => setPickerTab('folders')}
                  className={`flex-1 text-xs py-1.5 font-medium transition-colors ${
                    pickerTab === 'folders'
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  Pastas
                </button>
              </div>

              <div className="max-h-52 overflow-y-auto">
                {pickerTab === 'files' ? (
                  filteredPickerFiles.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Nenhum arquivo encontrado</p>
                  ) : (
                    filteredPickerFiles.map((file) => {
                      const { icon: Icon, color } = getFileTypeInfo(file.name);
                      const attached = isAttached(file);
                      return (
                        <button
                          key={`${file.folder || ''}-${file.name}`}
                          onClick={() => toggleFile(file)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors ${
                            attached ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                            attached ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            {attached && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                          <span className="flex-1 text-xs text-gray-700 dark:text-gray-200 truncate">{file.name}</span>
                          {file.folder && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[60px]">{file.folder}</span>
                          )}
                        </button>
                      );
                    })
                  )
                ) : (
                  filteredPickerFolders.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Nenhuma pasta encontrada</p>
                  ) : (
                    filteredPickerFolders.map(({ label, path, indent }) => {
                      const attached = isFolderAttached(path);
                      const fileCount = (allFiles || []).filter((f) => {
                        const ff = f.folder || '';
                        return ff === path || ff.startsWith(path + '/');
                      }).length;
                      return (
                        <button
                          key={path === '' ? '__root__' : path}
                          onClick={() => toggleFolder(path)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors ${
                            attached ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          {indent && <span className="w-3 flex-shrink-0" />}
                          <div className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                            attached ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            {attached && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <Folder className={`w-4 h-4 flex-shrink-0 ${attached ? 'text-blue-500' : 'text-amber-500'}`} />
                          <span className="flex-1 text-xs text-gray-700 dark:text-gray-200 truncate">{label}</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">{fileCount} arq.</span>
                        </button>
                      );
                    })
                  )
                )}
              </div>

              {totalAttached > 0 && (
                <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {totalAttached} item{totalAttached > 1 ? 's' : ''} selecionado{totalAttached > 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => { setShowPicker(false); setPickerSearch(''); }}
                    className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
                  >
                    Confirmar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Chips de arquivos e pastas anexados */}
          {totalAttached > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {attachedFolders.map((path) => {
                const label = path || 'Raiz';
                return (
                  <span
                    key={`folder-${path}`}
                    className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded-lg px-2 py-1 max-w-[160px]"
                  >
                    <Folder className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{label}</span>
                    <button
                      onClick={() => removeAttachedFolder(path)}
                      className="ml-0.5 flex-shrink-0 hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
              {attachedFiles.map((file) => {
                const { icon: Icon, color } = getFileTypeInfo(file.name);
                return (
                  <span
                    key={file.name}
                    className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-lg px-2 py-1 max-w-[140px]"
                  >
                    <Icon className={`w-3 h-3 flex-shrink-0 ${color}`} />
                    <span className="truncate">{file.name}</span>
                    <button
                      onClick={() => removeAttached(file.name)}
                      className="ml-0.5 flex-shrink-0 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 items-end">
            {/* Botão anexar */}
            {hasFiles && (
              <button
                onClick={() => setShowPicker((v) => !v)}
                title="Anexar arquivos"
                className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${
                  showPicker || attachedFiles.length > 0
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                <Paperclip className="w-4 h-4" />
              </button>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                totalAttached > 0
                  ? 'Pergunte sobre os anexados...'
                  : hasFiles
                  ? 'Pergunte sobre seus arquivos...'
                  : 'Sem arquivos ainda...'
              }
              rows={1}
              disabled={!hasFiles || loading || agentRunning}
              style={{ minHeight: '40px', maxHeight: '160px' }}
              className="flex-1 resize-none overflow-y-auto bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white dark:focus:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading || agentRunning || !hasFiles}
              className={`p-2.5 rounded-xl text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
                agentMode ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {(loading || agentRunning)
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : agentMode ? <Cpu className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1.5 text-center">
            Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </aside>

      {/* Modal de preview */}
      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </>
  );
}
