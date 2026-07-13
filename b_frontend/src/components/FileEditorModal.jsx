import { useEffect, useRef, useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { getFileUrl } from '../utils/helpers';
import { writeFileContent } from '../services/api';
import { useClosingAnimation } from '../hooks/useClosingAnimation';

export default function FileEditorModal({ file, onClose, onSaved }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);
  const [dirty, setDirty]     = useState(false);
  const textareaRef           = useRef(null);
  const { closing, handleClose } = useClosingAnimation(onClose);

  // Carrega conteúdo do arquivo via URL estática
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && handleClose();
    window.addEventListener('keydown', onKey);
    fetch(getFileUrl(file))
      .then((r) => {
        if (!r.ok) throw new Error('Não foi possível carregar o arquivo.');
        return r.text();
      })
      .then((t) => { setContent(t); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await writeFileContent(file.name, file.folder || '', content);
      setDirty(false);
      onSaved?.();
      handleClose();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Erro ao salvar arquivo.');
      setSaving(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 ${closing ? 'animate-overlay-hide' : 'animate-overlay'}`}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden ${closing ? 'animate-modal-hide' : 'animate-modal'}`}>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{file.name}</p>
            {file.folder && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                📍 {file.folder.split('/').join(' › ')}
              </p>
            )}
          </div>
          {dirty && (
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
              Não salvo
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading || !dirty}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar
          </button>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Área de edição */}
        <div className="flex-1 flex flex-col min-h-0 p-1">
          {loading ? (
            <div className="flex items-center justify-center flex-1 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center flex-1 text-red-500 text-sm px-6 text-center">
              {error}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              autoFocus
              value={content}
              onChange={(e) => { setContent(e.target.value); setDirty(true); }}
              onKeyDown={(e) => { if (e.ctrlKey && e.key === 's') { e.preventDefault(); if (dirty && !saving) handleSave(); } }}
              spellCheck={false}
              className="flex-1 resize-none w-full min-h-[400px] p-4 font-mono text-sm text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 leading-relaxed"
            />
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
          <span className="text-xs text-gray-400 dark:text-gray-600">
            {content.length} caracteres · {content.split('\n').length} linhas
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-600">
            Ctrl+S para salvar
          </span>
        </div>

      </div>
    </div>
  );
}
