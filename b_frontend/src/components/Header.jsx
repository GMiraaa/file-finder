import { useRef, useState, useEffect, useCallback } from 'react';
import { Search, Files, X, Moon, Sun, SlidersHorizontal, Check, LogOut, UserCircle, Bell, Trash2, FileText, Loader2 } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationsContext';
import { suggestFiles } from '../services/api';
import { getFileTypeInfo } from '../utils/helpers';

export default function Header({
  onUploadClick,
  filenameQuery,
  onFilenameSearch,
  isDark,
  onToggleTheme,
  filterExts = [],
  onFilterExts,
  availableExts = [],
  user,
  onLogout,
  onNavigateToSpace,    // (spacePath: string) => void — para navegar ao clicar na sugestão
}) {
  const inputRef       = useRef(null);
  const filterRef      = useRef(null);
  const logoutRef      = useRef(null);
  const notifRef       = useRef(null);
  const suggestRef     = useRef(null);
  const [filterOpen, setFilterOpen]       = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [notifOpen, setNotifOpen]           = useState(false);
  const [selectedNotifs, setSelectedNotifs]   = useState(new Set());
  const [seenCount, setSeenCount]             = useState(0);

  // Sugestões de conteúdo (vector search)
  const [suggestions, setSuggestions]   = useState([]);
  const [suggestOpen, setSuggestOpen]   = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const debounceRef = useRef(null);
  const { notifications, removeNotification, clearAll } = useNotifications();
  const unread = notifications.length > seenCount;

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

  // Fecha confirmação de saída ao clicar fora
  useEffect(() => {
    if (!confirmLogout) return;
    const handler = (e) => {
      if (logoutRef.current && !logoutRef.current.contains(e.target)) {
        setConfirmLogout(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [confirmLogout]);

  // Fecha notificações ao clicar fora
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
        setSelectedNotifs(new Set());
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  // Fecha sugestões ao clicar fora
  useEffect(() => {
    if (!suggestOpen) return;
    const handler = (e) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [suggestOpen]);

  // Busca vetorial com debounce de 450 ms
  const handleSearchInput = useCallback((value) => {
    onFilenameSearch(value);
    clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setSuggestOpen(false);
      setSuggestLoading(false);
      return;
    }
    // Abre imediatamente com estado de carregamento
    setSuggestLoading(true);
    setSuggestOpen(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await suggestFiles(value.trim());
        setSuggestions(data.suggestions || []);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestLoading(false);
      }
    }, 450);
  }, [onFilenameSearch]);

  const handleSuggestionClick = (s) => {
    setSuggestOpen(false);
    setSuggestions([]);
    onFilenameSearch('');
    if (onNavigateToSpace) onNavigateToSpace(s.folder || '');
  };

  const toggleNotifSelect = (id) => {    setSelectedNotifs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const deleteSelected = () => {
    selectedNotifs.forEach((id) => removeNotification(id));
    setSelectedNotifs(new Set());
  };

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
        {/* Barra de pesquisa com sugestões */}
        <div ref={suggestRef} className="flex-1 relative">
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2.5 transition-all focus-within:bg-white dark:focus-within:bg-gray-700 focus-within:shadow-md focus-within:ring-1 focus-within:ring-blue-400">
            <Search className={`w-4 h-4 flex-shrink-0 ${suggestLoading ? 'text-blue-400 animate-pulse' : 'text-gray-400 dark:text-gray-500'}`} />
            <input
              ref={inputRef}
              type="text"
              value={filenameQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => filenameQuery.trim().length >= 2 && setSuggestOpen(true)}
              onKeyDown={(e) => e.key === 'Escape' && setSuggestOpen(false)}
              placeholder="Pesquisar por nome ou conteúdo…"
              className="flex-1 bg-transparent outline-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 min-w-0"
            />
            {filenameQuery && (
              <button
                onClick={() => { onFilenameSearch(''); setSuggestions([]); setSuggestOpen(false); inputRef.current?.focus(); }}
                className="p-0.5 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              </button>
            )}
          </div>

          {/* Dropdown de sugestões */}
          {suggestOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Sugestões por conteúdo
                </span>
                <button onClick={() => setSuggestOpen(false)} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              </div>
              {suggestLoading ? (
                <div className="flex flex-col gap-2 px-3 py-3">
                  <div className="flex items-center gap-2.5 text-xs text-blue-500 dark:text-blue-400 mb-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                    <span>Buscando por conteúdo…</span>
                  </div>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-8 h-8 rounded-xl bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full w-3/4" />
                        <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : suggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                  <Search className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Nenhum arquivo encontrado
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                    Não há arquivos com conteúdo relacionado a essa busca
                  </p>
                </div>
              ) : suggestions.map((s, i) => {
                const { icon: Icon, color } = getFileTypeInfo(s.name);
                const location = s.folder
                  ? s.folder.includes('/') ? s.folder.replace('/', ' › ') : s.folder
                  : 'Geral';
                const score = Math.round(s.score * 100);
                return (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(s)}
                    className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 group-hover:bg-white dark:group-hover:bg-gray-700 flex items-center justify-center flex-shrink-0 transition-colors">
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{s.name}</span>
                        <span className="text-[10px] font-semibold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {score}%
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                        📁 {location}
                      </p>
                      {s.snippet && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1 italic">
                          "{s.snippet}"
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
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

          {/* Dropdown de filtro */}
          <div
            className={`absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 p-4
              transition-all duration-150 origin-top-right
              ${filterOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'}`}
          >
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
                          {ext}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Notíficações */}
      {user && (
        <div ref={notifRef} className="relative flex-shrink-0">
          <button
            onClick={() => { setNotifOpen((v) => !v); setSelectedNotifs(new Set()); if (!notifOpen) setSeenCount(notifications.length); }}
            title="Notificações"
            className={`relative p-2 rounded-full transition-all ${
              notifOpen ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            } text-gray-400 dark:text-gray-500`}
          >
            <Bell className="w-4 h-4" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>

          <div
            className={`absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden
              transition-all duration-200 ease-out origin-top-right
              ${notifOpen
                ? 'opacity-100 scale-100 translate-y-0'
                : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
              }`}
          >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Notificações {unread > 0 && <span className="ml-1 text-xs font-normal text-gray-400">({unread})</span>}
                </span>
                <div className="flex items-center gap-2">
                  {selectedNotifs.size > 0 && (
                    <button
                      onClick={deleteSelected}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Excluir ({selectedNotifs.size})
                    </button>
                  )}
                  {unread > 0 && selectedNotifs.size === 0 && (
                    <button
                      onClick={() => { clearAll(); setSeenCount(0); setNotifOpen(false); }}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      Limpar todas
                    </button>
                  )}
                </div>
              </div>

              {/* Lista */}
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                    <Bell className="w-8 h-8 text-gray-200 dark:text-gray-700 mb-2" />
                    <p className="text-xs text-gray-400 dark:text-gray-600">Nenhuma notificação</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const sel = selectedNotifs.has(n.id);
                    const dot = n.type === 'success' ? 'bg-green-500' : n.type === 'error' ? 'bg-red-500' : 'bg-blue-400';
                    const mins = Math.floor((Date.now() - n.time) / 60000);
                    const timeLabel = mins < 1 ? 'agora' : mins < 60 ? `${mins}min` : `${Math.floor(mins/60)}h`;
                    return (
                      <div
                        key={n.id}
                        onClick={() => toggleNotifSelect(n.id)}
                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0 transition-colors ${
                          sel ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
                        <p className="flex-1 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{n.message}</p>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap mt-0.5">{timeLabel}</span>
                      </div>
                    );
                  })
                )}
              </div>
          </div>
        </div>
      )}

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

      {/* Usuário + Sair */}
      {user && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
            <UserCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <span className="hidden sm:inline font-medium max-w-[120px] truncate">{user.username}</span>
          </div>

          {/* Botão sair com confirmação */}
          <div ref={logoutRef} className="relative">
            <button
              onClick={() => setConfirmLogout((v) => !v)}
              title="Sair"
              className={`p-2 rounded-full transition-colors ${
                confirmLogout
                  ? 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-500 dark:hover:text-red-400 text-gray-400 dark:text-gray-500'
              }`}
            >
              <LogOut className="w-4 h-4" />
            </button>

            <div
              className={`absolute right-0 top-full mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-50 p-4 w-52
                transition-all duration-150 origin-top-right
                ${confirmLogout ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'}`}
            >
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">Sair da conta?</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Você precisará fazer login novamente.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmLogout(false)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => { setConfirmLogout(false); onLogout(); }}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-medium text-white transition-colors"
                  >
                    Sair
                  </button>
                </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
