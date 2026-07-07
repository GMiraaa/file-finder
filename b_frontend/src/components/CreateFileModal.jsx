import { useEffect, useRef, useState } from 'react';
import { X, FilePlus, Loader2, ChevronDown } from 'lucide-react';
import { createFile } from '../services/api';

const EXTENSIONS = [
  { ext: 'txt',  label: 'Texto simples' },
  { ext: 'md',   label: 'Markdown' },
  { ext: 'json', label: 'JSON' },
  { ext: 'csv',  label: 'CSV' },
  { ext: 'yaml', label: 'YAML' },
  { ext: 'html', label: 'HTML' },
  { ext: 'css',  label: 'CSS' },
  { ext: 'js',   label: 'JavaScript' },
  { ext: 'ts',   label: 'TypeScript' },
  { ext: 'py',   label: 'Python' },
  { ext: 'sh',   label: 'Shell' },
  { ext: 'sql',  label: 'SQL' },
];

const DEFAULT_CONTENT = {
  json:  '{\n  \n}',
  html:  '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8" />\n  <title>Documento</title>\n</head>\n<body>\n  \n</body>\n</html>',
  yaml:  '# YAML\n',
  csv:   'coluna1,coluna2,coluna3\n',
  md:    '# Título\n\n',
  sh:    '#!/bin/bash\n\n',
};

export default function CreateFileModal({ folder, onClose, onSuccess }) {
  const [name, setName]       = useState('');
  const [ext, setExt]         = useState('txt');
  const [content, setContent] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);
  const nameRef    = useRef(null);
  const contentRef = useRef(null);

  // Pré-preenche conteúdo padrão ao trocar extensão
  useEffect(() => {
    setContent(DEFAULT_CONTENT[ext] ?? '');
  }, [ext]);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fullName = name.trim() ? `${name.trim()}.${ext}` : '';

  const handleSave = async () => {
    if (!name.trim()) { setError('Informe um nome para o arquivo.'); return; }
    setSaving(true);
    setError(null);
    try {
      const { data } = await createFile(fullName, folder, content);
      onSuccess(data.file);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Erro ao criar arquivo.');
      setSaving(false);
    }
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); contentRef.current?.focus(); }
  };

  const folderLabel = folder
    ? folder.split('/').join(' › ')
    : 'Raiz';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[90vh]">

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
            <FilePlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Criar novo arquivo</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              📍 {folderLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nome + extensão */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Input do nome (sem extensão) */}
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              onKeyDown={handleNameKeyDown}
              placeholder="nome-do-arquivo"
              maxLength={128}
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <span className="text-gray-400 dark:text-gray-500 font-mono text-sm flex-shrink-0">.</span>
            {/* Seletor de extensão */}
            <div className="relative flex-shrink-0">
              <select
                value={ext}
                onChange={(e) => setExt(e.target.value)}
                className="appearance-none text-sm pl-3 pr-8 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono cursor-pointer"
              >
                {EXTENSIONS.map(({ ext: e, label }) => (
                  <option key={e} value={e}>{e} — {label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            </div>
            {/* Preview do nome final */}
            {name.trim() && (
              <span className="text-xs text-gray-400 dark:text-gray-500 font-mono whitespace-nowrap">
                → <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{fullName}</span>
              </span>
            )}
          </div>
          {error && (
            <p className="mt-2 text-xs text-red-500 dark:text-red-400">{error}</p>
          )}
        </div>

        {/* Editor de conteúdo */}
        <div className="flex-1 flex flex-col min-h-0 p-1">
          <textarea
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Conteúdo do arquivo..."
            spellCheck={false}
            className="flex-1 resize-none w-full min-h-[320px] p-4 font-mono text-sm text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder-gray-400 dark:placeholder-gray-600 leading-relaxed"
          />
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
          <span className="text-xs text-gray-400 dark:text-gray-600">
            {content.length} caractere{content.length !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Criar arquivo
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
