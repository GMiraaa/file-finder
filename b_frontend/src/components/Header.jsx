import { useState, useRef } from 'react';
import { Search, Upload, Sparkles, Loader2, Files, X } from 'lucide-react';

export default function Header({ onSearch, onUploadClick, searching, searchQuery, onClearSearch }) {
  const [query, setQuery] = useState(searchQuery || '');
  const inputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  const handleClear = () => {
    setQuery('');
    onClearSearch();
    inputRef.current?.focus();
  };

  return (
    <header className="flex items-center gap-4 px-4 h-16 border-b border-gray-200 bg-white shadow-sm flex-shrink-0 z-20">
      {/* Logo */}
      <div className="flex items-center gap-2 min-w-[180px]">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
          <Files className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-semibold text-gray-800 tracking-tight">
          File<span className="text-blue-600">Finder</span>
        </span>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex-1 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2.5 transition-all focus-within:bg-white focus-within:shadow-md focus-within:ring-1 focus-within:ring-blue-400">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Descreva o que você procura e a IA vai encontrar..."
            className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400 min-w-0"
          />
          {query && (
            <button type="button" onClick={handleClear} className="p-0.5 rounded-full hover:bg-gray-200">
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
          <button
            type="submit"
            disabled={!query.trim() || searching}
            className="flex items-center gap-1.5 pl-2 border-l border-gray-300 text-blue-600 disabled:text-gray-400 transition-colors"
          >
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span className="text-xs font-semibold hidden sm:inline">
              {searching ? 'Buscando...' : 'Buscar com IA'}
            </span>
          </button>
        </div>
      </form>

      {/* Upload button */}
      <button
        onClick={onUploadClick}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm flex-shrink-0"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">Upload</span>
      </button>
    </header>
  );
}
