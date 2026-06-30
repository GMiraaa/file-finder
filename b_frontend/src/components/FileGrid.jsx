import { Upload, SearchX, Loader2, Sparkles } from 'lucide-react';
import FileCard from './FileCard';

export default function FileGrid({
  files,
  allFiles,
  loading,
  searching,
  searchResults,
  activeView,
  searchQuery,
  onDelete,
  onUploadClick,
}) {
  // Estado de loading inicial
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
        <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-5">
          <Upload className="w-12 h-12 text-blue-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">Nenhum arquivo ainda</h3>
        <p className="text-sm text-gray-500 mb-6 max-w-xs">
          Faça upload de arquivos para começar a usar a busca inteligente com IA
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

  // Buscando com IA
  if (searching) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4 animate-pulse">
          <Sparkles className="w-10 h-10 text-blue-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700">A IA está analisando seus arquivos...</h3>
        <p className="text-sm text-gray-500 mt-1">Isso pode levar alguns segundos</p>
      </div>
    );
  }

  // Nenhum resultado encontrado
  if (activeView === 'results' && searchResults !== null && files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <SearchX className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700">Nenhum arquivo encontrado</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">
          Tente descrever de outra forma o que você procura
        </p>
      </div>
    );
  }

  const getSearchResult = (filename) =>
    searchResults ? searchResults.find((r) => r.name === filename) || null : null;

  return (
    <div>
      {/* Cabeçalho dos resultados de busca */}
      {activeView === 'results' && searchResults !== null && (
        <div className="mb-5 flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
          <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">
              {files.length} {files.length === 1 ? 'arquivo encontrado' : 'arquivos encontrados'} para:
            </p>
            <p className="text-sm text-blue-600 italic mt-0.5">"{searchQuery}"</p>
          </div>
        </div>
      )}

      {/* Título da seção */}
      {activeView !== 'results' && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            {activeView === 'recent' ? 'Recentes' : 'Meus Arquivos'}
            <span className="ml-2 text-gray-400 font-normal normal-case">({files.length})</span>
          </h2>
        </div>
      )}

      {/* Grid de arquivos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {files.map((file) => (
          <FileCard
            key={file.name}
            file={file}
            searchResult={getSearchResult(file.name)}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
