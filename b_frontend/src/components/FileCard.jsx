import { Trash2, Download, ExternalLink } from 'lucide-react';
import { getFileTypeInfo, formatFileSize, formatDate, isImageFile } from '../utils/helpers';

export default function FileCard({ file, searchResult, onDelete }) {
  const { icon: Icon, color, bg } = getFileTypeInfo(file.name);
  const fileUrl = `/files/${encodeURIComponent(file.name)}`;
  const ext = (file.ext || '').replace('.', '').toUpperCase() || '?';
  const isImage = isImageFile(file.name);

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Remover "${file.name}"?`)) {
      onDelete(file.name);
    }
  };

  return (
    <div className="group relative bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-blue-200 transition-all duration-200 flex flex-col">
      {/* Área de preview */}
      <div className={`relative h-32 flex items-center justify-center overflow-hidden ${isImage ? 'bg-gray-100' : bg}`}>
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
          className={`absolute inset-0 flex items-center justify-center ${isImage ? 'hidden' : 'flex'} ${bg}`}
        >
          <Icon className={`w-14 h-14 ${color} opacity-75`} />
        </div>

        {/* Badge de extensão */}
        <span className="absolute bottom-2 right-2 text-[10px] font-bold text-white bg-black/30 backdrop-blur-sm px-1.5 py-0.5 rounded-md z-10">
          {ext}
        </span>

        {/* Ações (visíveis no hover) */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <a
            href={fileUrl}
            download={file.name}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 bg-white/95 rounded-full shadow hover:bg-white transition-colors"
            title="Baixar"
          >
            <Download className="w-3.5 h-3.5 text-gray-600" />
          </a>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 bg-white/95 rounded-full shadow hover:bg-white transition-colors"
            title="Abrir"
          >
            <ExternalLink className="w-3.5 h-3.5 text-gray-600" />
          </a>
          <button
            onClick={handleDelete}
            className="p-1.5 bg-white/95 rounded-full shadow hover:bg-red-50 transition-colors"
            title="Remover"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      </div>

      {/* Informações do arquivo */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="text-sm font-medium text-gray-800 truncate leading-tight" title={file.name}>
          {file.name}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{formatFileSize(file.size)}</span>
          <span className="text-xs text-gray-400">{formatDate(file.uploadedAt)}</span>
        </div>

        {/* Badge de relevância da IA */}
        {searchResult && (
          <div className="mt-1.5 px-2 py-1.5 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-xs text-blue-700 leading-snug">{searchResult.reason}</p>
          </div>
        )}
      </div>
    </div>
  );
}
