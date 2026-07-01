import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, Loader2, Sparkles, Eye, Download,
  Lightbulb, Check, X, Paperclip, Search,
} from 'lucide-react';
import { sendMessage } from '../services/api';
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

export default function ChatPanel({ allFiles, pendingInsight, onApplyInsight }) {
  const hasFiles = allFiles && allFiles.length > 0;
  const [messages, setMessages]       = useState([INITIAL_MESSAGE]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  // Anexar arquivos
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [showPicker, setShowPicker]       = useState(false);
  const [pickerSearch, setPickerSearch]   = useState('');
  const pickerRef = useRef(null);

  const lastInsightId = useRef(null);
  const bottomRef     = useRef(null);
  const textareaRef   = useRef(null);

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
    setMessages((prev) => [
      ...prev,
      { role: 'model', content: pendingInsight.message, insight: { ...pendingInsight, status: 'pending' } },
    ]);
  }, [pendingInsight]);

  const updateInsightStatus = (msgIndex, status) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIndex && m.insight ? { ...m, insight: { ...m.insight, status } } : m
      )
    );
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
    pickerSearch
      ? f.name.toLowerCase().includes(pickerSearch.toLowerCase())
      : true
  );

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
    if (!text || loading) return;

    const snapshot = [...attachedFiles];
    setInput('');
    resetTextarea();
    setAttachedFiles([]);
    setShowPicker(false);
    textareaRef.current?.focus();

    const userMsg = { role: 'user', content: text, attachedFiles: snapshot };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      const history = next.slice(1, -1).map(({ role, content }) => ({ role, content }));
      const attachedNames = snapshot.map((f) => f.name);
      const { data } = await sendMessage(text, history, attachedNames);
      const reply = data.reply;
      const detectedFiles = detectFiles(reply, allFiles);
      setMessages((prev) => [...prev, { role: 'model', content: reply, detectedFiles }]);
    } catch (err) {
      const status = err?.response?.status;
      const msg =
        status === 429
          ? 'Limite de requisições atingido. Aguarde alguns segundos e tente novamente.'
          : 'Ocorreu um erro ao contatar a IA. Tente novamente.';
      setMessages((prev) => [...prev, { role: 'model', content: msg }]);
    } finally {
      setLoading(false);
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
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">FileFinder AI</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Pergunte sobre seus arquivos</p>
          </div>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {msg.role === 'model' && (
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5 ${
                  msg.insight ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-blue-100 dark:bg-blue-900/40'
                }`}>
                  {msg.insight
                    ? <Lightbulb className="w-4 h-4 text-amber-500" />
                    : <Bot className="w-4 h-4 text-blue-600" />}
                </div>
              )}

              <div className="max-w-[82%] flex flex-col gap-1.5">
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

                  {/* Arquivos anexados visíveis dentro da mensagem do usuário */}
                  {msg.role === 'user' && msg.attachedFiles && msg.attachedFiles.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1 border-t border-white/20 pt-2">
                      {msg.attachedFiles.map((f) => {
                        const { icon: Icon, color } = getFileTypeInfo(f.name);
                        return (
                          <span key={f.name} className="flex items-center gap-1.5 text-[11px] text-white/80">
                            <Paperclip className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{f.name}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Botões de ação do insight */}
                {msg.insight && msg.insight.suggested_space && (() => {
                  const { suggested_space, is_new_space, suggested_folder, is_new_folder } = msg.insight;
                  // Label do botão
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
                          <Check className="w-3.5 h-3.5" />
                          Organizado!
                        </span>
                      ) : msg.insight.status === 'dismissed' ? (
                        <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-600 italic px-1 py-1">
                          <X className="w-3 h-3" />
                          Sugestão recusada
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
                            <X className="w-3 h-3" />
                            Ignorar
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
              </div>
            </div>
          ))}

          {/* Indicador de digitação */}
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
          {showPicker && hasFiles && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-20">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Filtrar arquivos..."
                  className="flex-1 text-xs bg-transparent outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
                />
                {pickerSearch && (
                  <button onClick={() => setPickerSearch('')}>
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                )}
              </div>

              <div className="max-h-52 overflow-y-auto">
                {filteredPickerFiles.length === 0 ? (
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
                          attached
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300 dark:border-gray-600'
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
                )}
              </div>

              {attachedFiles.length > 0 && (
                <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {attachedFiles.length} arquivo{attachedFiles.length > 1 ? 's' : ''} selecionado{attachedFiles.length > 1 ? 's' : ''}
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

          {/* Chips de arquivos anexados */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
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
                attachedFiles.length > 0
                  ? 'Pergunte sobre os anexados...'
                  : hasFiles
                  ? 'Pergunte sobre seus arquivos...'
                  : 'Sem arquivos ainda...'
              }
              rows={1}
              disabled={!hasFiles || loading}
              style={{ minHeight: '40px', maxHeight: '160px' }}
              className="flex-1 resize-none overflow-y-auto bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white dark:focus:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading || !hasFiles}
              className="p-2.5 bg-blue-600 rounded-xl text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
