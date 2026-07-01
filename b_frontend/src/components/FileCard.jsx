import { useState } from 'react';
import { Trash2, Download, ExternalLink, Eye } from 'lucide-react';
import { getFileTypeInfo, formatFileSize, formatDate, isImageFile, getFileUrl } from '../utils/helpers';
import FilePreviewModal from './FilePreviewModal';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function FileCard({ file, onDelete }) {
  const { icon: Icon, color, bg } = getFileTypeInfo(file.name);
  const fileUrl = getFileUrl(file);
  const ext = (file.ext || '').replace('.', '').toUpperCase() || '?';
  const isImage = isImageFile(file.name);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = (e) => {
    e.stopPropagation();
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    onDelete(file.name, file.folder || '');
    setDeleteOpen(false);
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData('filename', file.name);
    e.dataTransfer.setData('fromFolder', file.folder || '');
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <>
      <div
        draggable
        onDragStart={handleDragStart}
        className="group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-700 transition-all duration-200 flex flex-col cursor-grab active:cursor-grabbing select-none"
      >
      {/* Área de preview */}
      <div className={`relative h-32 flex items-center justify-center overflow-hidden ${isImage ? 'bg-gray-100 dark:bg-gray-700' : `${bg} dark:bg-gray-700`}`}>
        {isImage ? (
          <img
            src={fileUrl}
            alt={file.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}

        {/* Fallback / ícone padrão (sempre presente mas oculto para imagens carregadas) */}
        <div
          className={`absolute inset-0 flex items-center justify-center ${isImage ? 'hidden' : 'flex'} ${bg} dark:bg-gray-700`}
        >
          <Icon className={`w-14 h-14 ${color} opacity-75`} />
        </div>

        {/* Badge de extensão */}
        <span className="absolute bottom-2 right-2 text-[10px] font-bold text-white bg-black/30 backdrop-blur-sm px-1.5 py-0.5 rounded-md z-10">
          {ext}
        </span>

        {/* Ações (visíveis no hover) */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => { e.stopPropagation(); setPreviewOpen(true); }}
            className="p-1.5 bg-white/95 dark:bg-gray-600/95 rounded-full shadow hover:bg-white dark:hover:bg-gray-600 transition-colors"
            title="Preview"
          >
            <Eye className="w-3.5 h-3.5 text-gray-600 dark:text-gray-200" />
          </button>
          <a
            href={fileUrl}
            download={file.name}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 bg-white/95 dark:bg-gray-600/95 rounded-full shadow hover:bg-white dark:hover:bg-gray-600 transition-colors"
            title="Baixar"
          >
            <Download className="w-3.5 h-3.5 text-gray-600 dark:text-gray-200" />
          </a>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 bg-white/95 dark:bg-gray-600/95 rounded-full shadow hover:bg-white dark:hover:bg-gray-600 transition-colors"
            title="Abrir"
          >
            <ExternalLink className="w-3.5 h-3.5 text-gray-600 dark:text-gray-200" />
          </a>
          <button
            onClick={handleDelete}
            className="p-1.5 bg-white/95 dark:bg-gray-600/95 rounded-full shadow hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
            title="Remover"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
          </button>
        </div>
      </div>

      {/* Informações do arquivo */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate leading-tight" title={file.name}>
          {file.name}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-gray-500">{formatFileSize(file.size)}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(file.uploadedAt)}</span>
        </div>
      </div>
    </div>

      {previewOpen && (
        <FilePreviewModal file={file} onClose={() => setPreviewOpen(false)} />
      )}
      {deleteOpen && (
        <DeleteConfirmModal
          fileName={file.name}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteOpen(false)}
        />
      )}
    </>
  );
}
