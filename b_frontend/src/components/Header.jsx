import { useRef, useState, useEffect } from 'react';
import { Search, Upload, Files, X, Moon, Sun, SlidersHorizontal, Check } from 'lucide-react';

export default function Header({
  onUploadClick,
  filenameQuery,
  onFilenameSearch,
  isDark,
  onToggleTheme,
  filterExts = [],
  onFilterExts,
  availableExts = [],
}) {
  const inputRef     = useRef(null);
  const filterRef    = useRef(null);
  const [filterOpen, setFilterOpen] = useState(false);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen]);

  const toggleExt = (ext) => {
    onFilterExts((prev) =>
      prev.includes(ext) ? prev.filter((e) => e !== ext) : [...prev, ext]
    );
  };

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

      {/* Busca + filtro */}
      <div className="flex-1 max-w-xl mx-auto flex items-center gap-2">
        {/* Barra de pesquisa */}
        <div className="flex-1 flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2.5 transition-all focus-within:bg-white dark:focus-within:bg-gray-700 focus-within:shadow-md focus-within:ring-1 focus-within:ring-blue-400">
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

        {/* Botão de filtro */}
        <div ref={filterRef} className="relative flex-shrink-0">
          <button
            onClick={() => setFilterOpen((o) => !o)}
            title="Filtrar por extensão"
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-full border transition-colors text-sm font-medium ${
              filterOpen || filterExts.length > 0
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filtros</span>
            {filterExts.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {filterExts.length}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {filterOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Filtrar por extensão
                </span>
                {filterExts.length > 0 && (
                  <button
                    onClick={() => onFilterExts([])}
                    className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    Limpar tudo
                  </button>
                )}
              </div>

              {availableExts.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-600 italic text-center py-2">
                  Nenhum arquivo disponível
                </p>
              ) : (
                <div className="flex flex-col">
                  {availableExts.map((ext) => {
                    const active = filterExts.includes(ext);
                    return (
                      <button
                        key={ext}
                        onClick={() => toggleExt(ext)}
                        className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group text-left"
                      >
                        {/* Checkbox customizado */}
                        <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                          active
                            ? 'bg-blue-500 border-blue-500'
                            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 group-hover:border-blue-400'
                        }`}>
                          {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                        </span>
                        <span className={`text-sm font-medium transition-colors ${
                          active
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          .{ext}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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
