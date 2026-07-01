import { useState } from 'react';
import { Upload, SearchX, Loader2, FolderPlus, ChevronRight, Home } from 'lucide-react';
import FileCard from './FileCard';
import FolderCard from './FolderCard';

export default function FileGrid({
  files,
  folders,
  allFilesCount,
  loading,
  activeView,
  filenameQuery,
  currentFolder,
  onDelete,
  onUploadClick,
  onNavigateFolder,
  onNavigateBack,
  onCreateFolder,
  onDeleteFolder,
  onMoveFile,
}) {
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [rootDragOver, setRootDragOver] = useState(false);

  const totalItems = files.length + (folders?.length || 0);
  const isInsideFolder = !!currentFolder;

  const handleCreateFolder = (e) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (trimmed) {
      onCreateFolder(trimmed);
      setNewFolderName('');
      setShowNewFolder(false);
    }
  };

  // Drop zone "voltar para raiz" (quando dentro de pasta)
  const handleRootDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setRootDragOver(true);
  };
  const handleRootDragLeave = () => setRootDragOver(false);
  const handleRootDrop = (e) => {
    e.preventDefault();
    setRootDragOver(false);
    const filename = e.dataTransfer.getData('filename');
    const fromFolder = e.dataTransfer.getData('fromFolder');
    if (filename && fromFolder) {
      onMoveFile(filename, fromFolder, '');
    }
  };

  // Loading inicial
  if (loading && allFilesCount === 0 && !currentFolder) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Nenhum arquivo / pasta ainda (só na raiz)
  if (!loading && allFilesCount === 0 && !currentFolder && !filenameQuery) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-5">
          <Upload className="w-12 h-12 text-blue-400 dark:text-blue-500" />
        </div>
        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Nenhum arquivo ainda</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
          Faça upload de arquivos para começar. Use o chat à direita para buscar por conteúdo.
        </p>
        <button
          onClick={onUploadClick}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 transition-colors shadow-sm"
        >
          Fazer primeiro upload
        </button>
      </div>
    );
  }

  // Sem resultados para filtro
  if (filenameQuery && files.length === 0 && (folders?.length || 0) === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <SearchX className="w-10 h-10 text-gray-400 dark:text-gray-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Nenhum arquivo encontrado</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Não há arquivo com "<span className="font-medium">{filenameQuery}</span>" no nome
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb / toolbar */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
          {isInsideFolder ? (
            <>
              <button
                onClick={onNavigateBack}
                className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
              >
                <Home className="w-3.5 h-3.5" />
                Início
              </button>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-gray-700 dark:text-gray-200 font-semibold">{currentFolder}</span>
              <span className="text-gray-400 dark:text-gray-600 font-normal">({files.length} arquivo{files.length !== 1 ? 's' : ''})</span>
            </>
          ) : (
            <>
              <span className="font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide text-xs">
                {filenameQuery
                  ? `Resultados para "${filenameQuery}"`
                  : activeView === 'recent'
                  ? 'Recentes'
                  : 'Meus Arquivos'}
              </span>
              <span className="text-gray-400 dark:text-gray-600">({totalItems})</span>
            </>
          )}
        </div>

        {/* Botão nova pasta (somente raiz, sem filtro) */}
        {!isInsideFolder && !filenameQuery && (
          <div className="flex items-center gap-2">
            {showNewFolder ? (
              <form onSubmit={handleCreateFolder} className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setShowNewFolder(false)}
                  placeholder="Nome da pasta"
                  maxLength={64}
                  className="text-sm px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Criar
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewFolder(false)}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowNewFolder(true)}
                className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                Nova pasta
              </button>
            )}
          </div>
        )}
      </div>

      {/* Drop zone "Mover para raiz" quando dentro de pasta */}
      {isInsideFolder && (
        <div
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
          className={`mb-3 rounded-xl border-2 border-dashed px-4 py-2 text-center text-xs font-medium transition-all duration-150 cursor-default
            ${rootDragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
              : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600'
            }`}
        >
          {rootDragOver ? 'Soltar para mover para a raiz' : 'Arraste arquivos aqui para mover para a raiz'}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {/* Pastas primeiro (somente raiz) */}
        {!isInsideFolder && folders && folders.map((folder) => (
          <FolderCard
            key={folder.name}
            folder={folder}
            onNavigate={onNavigateFolder}
            onDelete={onDeleteFolder}
            onDrop={onMoveFile}
          />
        ))}
        {/* Arquivos */}
        {files.map((file) => (
          <FileCard key={`${file.folder || ''}-${file.name}`} file={file} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}
