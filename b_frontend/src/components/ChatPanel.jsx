import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, Sparkles } from 'lucide-react';
import { sendMessage } from '../services/api';

const INITIAL_MESSAGE = {
  role: 'model',
  content:
    'Olá! Sou o FileFinder AI. Posso responder perguntas sobre o conteúdo dos seus arquivos — resumos, comparações, busca de informações específicas e muito mais. Como posso ajudar?',
};

export default function ChatPanel({ hasFiles }) {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef(null);
  const textareaRef             = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Ajusta altura do textarea conforme o conteúdo
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
      // Envia o histórico sem a mensagem de boas-vindas inicial
      const history = next.slice(1, -1).map(({ role, content }) => ({ role, content }));
      const { data } = await sendMessage(text, history);
      setMessages((prev) => [...prev, { role: 'model', content: data.reply }]);
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
            {/* Avatar do bot */}
            {msg.role === 'model' && (
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mb-0.5">
                <Bot className="w-4 h-4 text-blue-600" />
              </div>
            )}

            <div
              className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Indicador de digitação */}
        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
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
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1.5 text-center">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </aside>
  );
}
