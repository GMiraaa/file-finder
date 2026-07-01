import { Upload, SearchX, Loader2 } from 'lucide-react';
import FileCard from './FileCard';

export default function FileGrid({
  files,
  allFiles,
  loading,
  activeView,
  filenameQuery,
  onDelete,
  onUploadClick,
}) {
  // Loading inicial
  if (loading && allFiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Nenhum arquivo ainda
  if (!loading && allFiles.length === 0) {
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

  // Nenhum resultado para o nome pesquisado
  if (filenameQuery && files.length === 0) {
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
      {/* Título da seção */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {filenameQuery
            ? `Resultados para "${filenameQuery}"`
            : activeView === 'recent'
            ? 'Recentes'
            : 'Meus Arquivos'}
          <span className="ml-2 text-gray-400 font-normal normal-case">({files.length})</span>
        </h2>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {files.map((file) => (
          <FileCard key={file.name} file={file} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}
