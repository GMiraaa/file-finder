import { useEffect, useRef, useState } from 'react';
import { X, Download, ExternalLink, FolderInput, Pencil, Check, SquarePen } from 'lucide-react';
import { getFileTypeInfo, formatFileSize } from '../utils/helpers';
import { getFileUrl, isEditableFile } from '../utils/helpers';
import MoveToSpaceModal from './MoveToSpaceModal';
import FileEditorModal from './FileEditorModal';
import { useClosingAnimation } from '../hooks/useClosingAnimation';

const TEXT_EXTS = new Set([
  'txt','md','json','csv','js','ts','jsx','tsx','py','java','c','cpp',
  'h','css','scss','html','xml','yaml','yml','sh','sql','env','ini',
  'toml','conf','log','rb','php','go','rs','kt',
]);

export default function FilePreviewModal({ file, onClose, onMoveFileTo, onRenameFile }) {
  const fileUrl = getFileUrl(file);
  const ext = (file.ext || '').replace('.', '').toLowerCase();
  const isImage = ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext);
  const isPdf   = ext === 'pdf';
  const isText  = TEXT_EXTS.has(ext);
  const { icon: Icon, color, bg } = getFileTypeInfo(file.name);
  const { closing, handleClose } = useClosingAnimation(onClose);

  const [textContent, setTextContent] = useState(null);
  const [textLoading, setTextLoading] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const canEdit = isEditableFile(file.name);
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(file.name);
  const [renaming, setRenaming] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (isText) {
      setTextLoading(true);
      fetch(fileUrl, { cache: 'no-store' })
        .then(r => r.text())
        .then(t => setTextContent(t))
        .catch(() => setTextContent('Erro ao carregar conteúdo.'))
        .finally(() => setTextLoading(false));
    }
  }, [fileUrl, isText]);

  const startEditing = () => {
    if (!onRenameFile) return;
    setNameValue(file.name);
    setEditing(true);
    setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 0);
  };

  const cancelEditing = () => {
    setEditing(false);
    setNameValue(file.name);
  };

  const confirmRename = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === file.name) { cancelEditing(); return; }
    setRenaming(true);
    await onRenameFile(file.name, file.folder || '', trimmed);
    setRenaming(false);
    setEditing(false);
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 ${closing ? 'animate-overlay-hide' : 'animate-overlay'}`}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden ${closing ? 'animate-modal-hide' : 'animate-modal'}`}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />

          {/* Nome editável */}
          {editing ? (
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmRename();
                  if (e.key === 'Escape') cancelEditing();
                }}
                disabled={renaming}
                className="flex-1 text-sm font-semibold bg-transparent border-b-2 border-blue-500 outline-none text-gray-800 dark:text-gray-100 min-w-0"
              />
              <button
                onClick={confirmRename}
                disabled={renaming}
                className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors flex-shrink-0"
                title="Confirmar"
              >
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
              </button>
              <button
                onClick={cancelEditing}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                title="Cancelar"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          ) : (
            <div
              className={`flex-1 flex items-center gap-1.5 min-w-0 group/name ${onRenameFile ? 'cursor-text' : ''}`}
              onClick={startEditing}
              title={onRenameFile ? 'Clique para renomear' : undefined}
            >
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{file.name}</p>
              {onRenameFile && (
                <Pencil className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0 opacity-0 group-hover/name:opacity-100 transition-opacity" />
              )}
            </div>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{formatFileSize(file.size)}</span>
          {canEdit && (
            <button
              onClick={() => setEditOpen(true)}
              className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
              title="Editar arquivo"
            >
              <SquarePen className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            </button>
          )}
          {onMoveFileTo && (
            <button
              onClick={() => setMoveOpen(true)}
              className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
              title="Mover para espaço"
            >
              <FolderInput className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            </button>
          )}
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
            onClick={handleClose}
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
      {editOpen && canEdit && (
        <FileEditorModal
          file={file}
          onClose={() => setEditOpen(false)}
          onSaved={() => setEditOpen(false)}
        />
      )}
      {moveOpen && onMoveFileTo && (
        <MoveToSpaceModal
          file={file}
          onClose={() => setMoveOpen(false)}
          onMove={async (name, from, to) => {
            await onMoveFileTo(name, from, to);
            handleClose();
          }}
        />
      )}
    </div>
  );
}
