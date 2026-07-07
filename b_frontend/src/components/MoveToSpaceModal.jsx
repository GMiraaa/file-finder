import { useEffect, useRef, useState } from 'react';
import { X, FolderInput, Loader2 } from 'lucide-react';
import { getSpaceStructure } from '../services/api';

export default function MoveToSpaceModal({ file, onClose, onMove }) {
  const [structure, setStructure] = useState(null); // { spaceName: [subfolder, ...] }
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);   // null = nada selecionado; '' = raiz; 'Space' ou 'Space/Sub'
  const [moving, setMoving] = useState(false);
  const cancelRef = useRef(null);

  const currentLocation = file.folder !== undefined ? (file.folder || '') : null; // null = bulk (não destacar atual)

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    getSpaceStructure()
      .then(({ data }) => setStructure(data))
      .catch(() => setStructure({}))
      .finally(() => setLoading(false));
  }, []);

  const handleMove = async () => {
    if (selected === null) return;
    if (currentLocation !== null && selected === currentLocation) return;
    setMoving(true);
    await onMove(file.name, file.folder || '', selected);
    setMoving(false);
    onClose();
  };

  // Monta lista de destinos: raiz + cada espaço + subpastas indentadas
  const destinations = [{ label: 'Sem espaço (raiz)', path: '', indent: false }];
  if (structure) {
    for (const [space, subfolders] of Object.entries(structure)) {
      destinations.push({ label: space, path: space, indent: false });
      for (const sub of subfolders) {
        destinations.push({ label: `${space} / ${sub}`, path: `${space}/${sub}`, indent: true });
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col gap-4 p-6">

        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <FolderInput className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                Mover para espaço
              </h2>
              <p
                className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[180px]"
                title={file.name}
              >
                {file.name}
              </p>
            </div>
          </div>
          <button
            ref={cancelRef}
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lista de destinos */}
        <div className="max-h-64 overflow-y-auto flex flex-col gap-0.5 -mx-1 px-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            </div>
          ) : (
            destinations.map(({ label, path, indent }) => {
              const isCurrent = currentLocation !== null && path === currentLocation;
              const isSelected = selected === path;
              return (
                <button
                  key={path === '' ? '__root__' : path}
                  disabled={isCurrent}
                  onClick={() => setSelected(path)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2
                    ${isCurrent
                      ? 'opacity-40 cursor-not-allowed bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      : isSelected
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                >
                  {indent && <span className="w-3 flex-shrink-0" />}
                  <span className="truncate">{label}</span>
                  {isCurrent && (
                    <span className="ml-auto text-xs font-medium whitespace-nowrap">atual</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleMove}
            disabled={selected === null || selected === currentLocation || moving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {moving && <Loader2 className="w-4 h-4 animate-spin" />}
            Mover
          </button>
        </div>

      </div>
    </div>
  );
}
