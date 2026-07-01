import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, Sparkles, Eye, Download, Lightbulb, Check, X } from 'lucide-react';
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
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const lastInsightId = useRef(null);
  const bottomRef     = useRef(null);
  const textareaRef   = useRef(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Injeta insight como mensagem especial quando chega do App
  useEffect(() => {
    if (!pendingInsight || pendingInsight.id === lastInsightId.current) return;
    lastInsightId.current = pendingInsight.id;
    setMessages((prev) => [
      ...prev,
      { role: 'model', content: pendingInsight.message, insight: { ...pendingInsight, status: 'pending' } },
    ]);
  }, [pendingInsight]);

  // Atualiza status de um insight pelo índice da mensagem
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

    setInput('');
    resetTextarea();
    textareaRef.current?.focus();

    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setLoading(true);

    try {
      const history = next.slice(1, -1).map(({ role, content }) => ({ role, content }));
      const { data } = await sendMessage(text, history);
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
      <aside className="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-900">
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
                  msg.insight
                    ? 'bg-amber-100 dark:bg-amber-900/40'
                    : 'bg-blue-100 dark:bg-blue-900/40'
                }`}>
                  {msg.insight
                    ? <Lightbulb className="w-4 h-4 text-amber-500" />
                    : <Bot className="w-4 h-4 text-blue-600" />}
                </div>
              )}

              <div className="max-w-[82%] flex flex-col gap-1.5">
                {/* Badge do insight */}
                {msg.insight && (
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider ml-0.5">
                    💡 Insight de organização
                  </span>
                )}

                {/* Balão da mensagem */}
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
                </div>

                {/* Botões de ação do insight */}
                {msg.insight && msg.insight.suggested_folder && (
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
                          {msg.insight.is_new_folder
                            ? `Criar "${msg.insight.suggested_folder}"`
                            : `Mover para "${msg.insight.suggested_folder}"`}
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
                )}

                {/* Cards de arquivos detectados pelo chat */}
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

        {/* Input */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          {!hasFiles && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-700/40 rounded-xl px-3 py-2 mb-2.5">
              Faça upload de arquivos para ativar o chat com IA.
            </p>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={hasFiles ? 'Pergunte sobre seus arquivos...' : 'Sem arquivos ainda...'}
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
