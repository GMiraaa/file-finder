import { useState } from 'react';
import { Folder, Trash2 } from 'lucide-react';

export default function FolderCard({ folder, onNavigate, onDelete, onDrop }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const filename = e.dataTransfer.getData('filename');
    const fromFolder = e.dataTransfer.getData('fromFolder');
    if (filename && fromFolder !== folder.name) {
      onDrop(filename, fromFolder, folder.name);
    }
  };
  const handleDelete = (e) => {
    e.stopPropagation();
    const label = folder.fileCount > 0
      ? `Remover pasta "${folder.name}" e seus ${folder.fileCount} arquivo(s)?`
      : `Remover pasta "${folder.name}"?`;
    if (window.confirm(label)) onDelete(folder.name);
  };

  return (
    <div
      onClick={() => onNavigate(folder.name)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group relative bg-white dark:bg-gray-800 border-2 rounded-2xl overflow-hidden cursor-pointer transition-all duration-150 select-none
        ${dragOver
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.03]'
          : 'border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-700'
        }`}
    >
      {/* Preview */}
      <div className="h-28 flex items-center justify-center bg-amber-50 dark:bg-amber-900/20 relative">
        <Folder className="w-14 h-14 text-amber-400" fill="currentColor" strokeWidth={1.5} />
        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-2 py-1 rounded-full">
              Soltar aqui
            </span>
          </div>
        )}
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 p-1.5 bg-white/95 dark:bg-gray-600/95 rounded-full shadow opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/40 transition-all duration-150"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </button>
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{folder.name}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {folder.fileCount} {folder.fileCount === 1 ? 'arquivo' : 'arquivos'}
        </p>
      </div>
    </div>
  );
}
