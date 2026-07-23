import { useEffect, useRef, useState } from 'react';
import { Folder, Trash2, MoreHorizontal, Pencil, Check, X } from 'lucide-react';

export default function FolderCard({ folder, onNavigate, onDelete, onDrop, onRename, isReadOnly = false }) {
  const [dragOver, setDragOver]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [renaming, setRenaming]   = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    if (isReadOnly) return;
    e.preventDefault(); setDragOver(false);
    const filename = e.dataTransfer.getData('filename');
    const fromFolder = e.dataTransfer.getData('fromFolder');
    const target = folder.navPath || folder.name;
    if (filename && fromFolder !== target) onDrop(filename, fromFolder, target);
  };

  const startRename = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    setRenameVal(folder.name);
    setRenaming(true);
  };

  const confirmRename = () => {
    const trimmed = renameVal.trim();
    if (trimmed && trimmed !== folder.name) onRename?.(folder.navPath || folder.name, trimmed);
    setRenaming(false);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    const label = folder.fileCount > 0
      ? `Remover pasta "${folder.name}" e seus ${folder.fileCount} arquivo(s)?`
      : `Remover pasta "${folder.name}"?`;
    if (window.confirm(label)) onDelete(folder.navPath || folder.name);
  };

  return (
    <div
      onClick={() => !renaming && onNavigate(folder.navPath || folder.name)}
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

        {/* 3-dot menu button — hidden in read-only mode */}
        {!isReadOnly && (
        <div ref={menuRef} className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 bg-white/95 dark:bg-gray-600/95 rounded-full shadow opacity-0 group-hover:opacity-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-150"
          >
            <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 w-32 animate-dropdown">
              <button
                onClick={startRename}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-gray-400" /> Renomear
              </button>
              <button
                onClick={handleDeleteClick}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        {renaming ? (
          <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); confirmRename(); }}
                onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setRenaming(false); }}
                onBlur={confirmRename}
                maxLength={48}
                className="flex-1 text-xs px-2 py-1 rounded-lg border border-indigo-400 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none"
              />
              <button type="submit" className="p-1 text-indigo-600"><Check className="w-3 h-3" /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setRenaming(false); }} className="p-1 text-gray-400"><X className="w-3 h-3" /></button>
            </div>
          </form>
        ) : (
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{folder.name}</p>
        )}
        {folder.spaceName && (
          <p className="text-[10px] text-indigo-500 dark:text-indigo-400 truncate font-medium">{folder.spaceName}</p>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {folder.fileCount} {folder.fileCount === 1 ? 'arquivo' : 'arquivos'}
        </p>
      </div>
    </div>
  );
}
