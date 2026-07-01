import { useRef } from 'react';
import { Search, Upload, Files, X, Moon, Sun } from 'lucide-react';

export default function Header({ onUploadClick, filenameQuery, onFilenameSearch, isDark, onToggleTheme }) {
  const inputRef = useRef(null);

  return (
    <header className="flex items-center gap-4 px-4 h-16 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm flex-shrink-0 z-20">
      {/* Logo */}
      <div className="flex items-center gap-2 min-w-[180px]">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
          <Files className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">
          File<span className="text-blue-500">Finder</span>
        </span>
      </div>

      {/* Busca por nome de arquivo */}
      <div className="flex-1 max-w-xl mx-auto">
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2.5 transition-all focus-within:bg-white dark:focus-within:bg-gray-700 focus-within:shadow-md focus-within:ring-1 focus-within:ring-blue-400">
          <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={filenameQuery}
            onChange={(e) => onFilenameSearch(e.target.value)}
            placeholder="Pesquisar arquivos por nome..."
            className="flex-1 bg-transparent outline-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 min-w-0"
          />
          {filenameQuery && (
            <button
              onClick={() => { onFilenameSearch(''); inputRef.current?.focus(); }}
              className="p-0.5 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Botão tema escuro/claro */}
      <button
        onClick={onToggleTheme}
        title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        className="p-2 rounded-full border border-gray-200/70 dark:border-gray-600/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
      >
        {isDark ? (
          <Moon className="w-5 h-5 text-blue-400" />
        ) : (
          <Sun className="w-5 h-5 text-yellow-500" />
        )}
      </button>

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
