import { useEffect, useState } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import { getFileTypeInfo, formatFileSize } from '../utils/helpers';
import { getFileUrl } from '../utils/helpers';

const TEXT_EXTS = new Set([
  'txt','md','json','csv','js','ts','jsx','tsx','py','java','c','cpp',
  'h','css','scss','html','xml','yaml','yml','sh','sql','env','ini',
  'toml','conf','log','rb','php','go','rs','kt',
]);

export default function FilePreviewModal({ file, onClose }) {
  const fileUrl = getFileUrl(file);
  const ext = (file.ext || '').replace('.', '').toLowerCase();
  const isImage = ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext);
  const isPdf   = ext === 'pdf';
  const isText  = TEXT_EXTS.has(ext);
  const { icon: Icon, color, bg } = getFileTypeInfo(file.name);

  const [textContent, setTextContent] = useState(null);
  const [textLoading, setTextLoading] = useState(false);

  useEffect(() => {
    if (isText) {
      setTextLoading(true);
      fetch(fileUrl)
        .then(r => r.text())
        .then(t => setTextContent(t))
        .catch(() => setTextContent('Erro ao carregar conteúdo.'))
        .finally(() => setTextLoading(false));
    }
  }, [fileUrl, isText]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />
          <p className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{file.name}</p>
          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{formatFileSize(file.size)}</span>
          <a
            href={fileUrl} download={file.name}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            title="Baixar"
          >
            <Download className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </a>
          <a
            href={fileUrl} target="_blank" rel="noopener noreferrer"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            title="Abrir em nova aba"
          >
            <ExternalLink className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </a>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 min-h-0">
          {isImage && (
            <img
              src={fileUrl}
              alt={file.name}
              className="max-w-full max-h-full mx-auto rounded-xl object-contain"
            />
          )}
          {isPdf && (
            <iframe
              src={fileUrl}
              title={file.name}
              className="w-full min-h-[65vh] rounded-xl border border-gray-200 dark:border-gray-700"
            />
          )}
          {isText && (
            textLoading
              ? <p className="text-sm text-gray-400 dark:text-gray-500 text-center mt-8">Carregando...</p>
              : <pre className="text-xs text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 rounded-xl p-4 overflow-auto whitespace-pre-wrap break-words max-h-[65vh]">{textContent}</pre>
          )}
          {!isImage && !isPdf && !isText && (
            <div className="flex flex-col items-center justify-center h-52 text-center">
              <div className={`w-20 h-20 rounded-2xl ${bg} dark:bg-gray-700 flex items-center justify-center mb-4`}>
                <Icon className={`w-10 h-10 ${color}`} />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Preview não disponível para este tipo de arquivo
              </p>
              <a
                href={fileUrl} download={file.name}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Baixar arquivo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
