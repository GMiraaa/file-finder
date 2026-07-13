import { useEffect, useRef, useState } from 'react';
import { HardDrive, Plus, Clock, FolderOpen, Trash2, Check, X, MoreHorizontal, Pencil, ChevronDown, Users } from 'lucide-react';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function Sidebar({
  activeView,
  onViewChange,
  fileCount,
  onUploadClick,
  sessions,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
}) {
  const [newName, setNewName]             = useState('');
  const [showNew, setShowNew]             = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  // 3-dot menu
  const [menuOpen, setMenuOpen]           = useState(null);  // session name
  const menuRef                           = useRef(null);
  // inline rename
  const [renamingSession, setRenamingSession] = useState(null); // name being renamed
  const [renameValue, setRenameValue]         = useState('');
  // collapse
  const [mySpacesOpen, setMySpacesOpen]       = useState(true);
  const [sharedOpen, setSharedOpen]           = useState(true);

  // Close 3-dot menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const navItems = [
    { id: 'all',    icon: HardDrive, label: 'Meus Arquivos', count: fileCount },
    { id: 'recent', icon: Clock,     label: 'Recentes' },
  ];

  const handleCreate = (e) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (trimmed) { onCreateSession(trimmed); setNewName(''); setShowNew(false); }
  };

  const handleDelete = (e, name) => {
    e.stopPropagation();
    setMenuOpen(null);
    setConfirmDelete(name);
  };

  const startRename = (e, name) => {
    e.stopPropagation();
    setMenuOpen(null);
    setRenamingSession(name);
    setRenameValue(name);
  };

  const confirmRename = (oldName) => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== oldName) onRenameSession?.(oldName, trimmed);
    setRenamingSession(null);
  };

  return (
    <aside className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col py-3 overflow-y-auto">
      {/* Botão Novo upload */}
      <div className="px-3 mb-4">
        <button
          onClick={onUploadClick}
          className="w-full flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:shadow-md active:shadow-sm text-gray-700 dark:text-gray-200 rounded-2xl px-4 py-3 text-sm font-medium transition-shadow dark:hover:bg-gray-700"
        >
          <Plus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          Novo upload
        </button>
      </div>

      {/* Navegação principal */}
      <nav className="px-3 space-y-0.5">
        {navItems.map(({ id, icon: Icon, label, count }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-full text-sm transition-colors ${
              activeView === id
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
            }`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 ${activeView === id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-500'}`} />
            <span className="flex-1 text-left truncate">{label}</span>
            {count !== undefined && count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                activeView === id
                  ? 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>{count}</span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Meus Espaços (retrátil) ── */}
      <div className="px-3 mt-5">
        <button
          onClick={() => setMySpacesOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 mb-2 group"
        >
          <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">
            Meus Espaços
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setShowNew((v) => !v); setNewName(''); }}
              title="Novo espaço"
              className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {mySpacesOpen
              ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 transition-transform duration-200" />
              : <ChevronDown className="w-3.5 h-3.5 text-gray-400 transition-transform duration-200 -rotate-90" />}
          </div>
        </button>

        <div
          className="collapsible-grid"
          style={{ gridTemplateRows: mySpacesOpen ? '1fr' : '0fr' }}
        >
          <div className="collapsible-inner">
            {/* Formulário novo espaço */}
            {showNew && (
              <form onSubmit={handleCreate} className="mb-2 px-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setShowNew(false)}
                  placeholder="Nome do espaço..."
                  maxLength={48}
                  className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <div className="flex gap-1 mt-1.5">
                  <button type="submit" disabled={!newName.trim()}
                    className="flex-1 flex items-center justify-center gap-1 text-xs py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                    <Check className="w-3 h-3" /> Criar
                  </button>
                  <button type="button" onClick={() => setShowNew(false)}
                    className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </form>
            )}

            {/* Lista de espaços */}
            <div className="space-y-0.5" ref={menuRef}>
              {sessions && sessions.length > 0 ? sessions.map((session) => {
                const isActive = activeView === session.name;
                const isRenaming = renamingSession === session.name;
                return (
                  <div key={session.name} className="relative group/item">
                    {isRenaming ? (
                      /* Inline rename input */
                      <form
                        onSubmit={(e) => { e.preventDefault(); confirmRename(session.name); }}
                        className="flex items-center gap-1 px-2 py-1"
                      >
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Escape') setRenamingSession(null); }}
                          onBlur={() => confirmRename(session.name)}
                          maxLength={48}
                          className="flex-1 text-xs px-2 py-1 rounded-lg border border-indigo-400 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none"
                        />
                        <button type="submit" className="p-1 text-indigo-600 hover:text-indigo-800">
                          <Check className="w-3 h-3" />
                        </button>
                      </form>
                    ) : (
                      <button
                        onClick={() => onViewChange(session.name)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-full text-sm transition-colors ${
                          isActive
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-semibold'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                        }`}
                      >
                        <FolderOpen className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`} />
                        <span className="flex-1 text-left truncate text-xs">{session.name}</span>
                        {session.fileCount > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            isActive ? 'bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300'
                                     : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          }`}>{session.fileCount}</span>
                        )}
                        {/* 3-dot menu button — oculto para Geral */}
                        {session.name !== 'Geral' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === session.name ? null : session.name); }}
                          className="flex-shrink-0 p-1 rounded-full opacity-0 group-hover/item:opacity-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                        >
                          <MoreHorizontal className="w-3 h-3 text-gray-500" />
                        </button>
                        )}
                      </button>
                    )}

                    {/* Dropdown menu */}
                    {menuOpen === session.name && (
                      <div className="absolute right-0 top-8 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 w-36 animate-dropdown">
                        <button
                          onClick={(e) => startRename(e, session.name)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5 text-gray-400" /> Renomear
                        </button>
                        {session.name !== 'Geral' && (
                          <button
                            onClick={(e) => handleDelete(e, session.name)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Excluir
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              }) : (
                !showNew && (
                  <p className="text-xs text-gray-400 dark:text-gray-600 px-3 py-1 italic">
                    Nenhum espaço ainda
                  </p>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Espaços Compartilhados (retrátil) ── */}
      <div className="px-3 mt-4">
        <button
          onClick={() => setSharedOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 mb-2"
        >
          <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">
            Compartilhados
          </span>
          {sharedOpen
            ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 transition-transform duration-200" />
            : <ChevronDown className="w-3.5 h-3.5 text-gray-400 transition-transform duration-200 -rotate-90" />}
        </button>
        <div
          className="collapsible-grid"
          style={{ gridTemplateRows: sharedOpen ? '1fr' : '0fr' }}
        >
          <div className="collapsible-inner px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800/50 text-center">
            <Users className="w-5 h-5 text-gray-300 dark:text-gray-600 mx-auto mb-1" />
            <p className="text-[11px] text-gray-400 dark:text-gray-600">
              Em breve: espaços compartilhados com outros usuários.
            </p>
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <div className="mt-auto px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
          {fileCount} {fileCount === 1 ? 'arquivo armazenado' : 'arquivos armazenados'}
        </p>
      </div>

      {/* Modal de confirmação de exclusão de espaço */}
      {confirmDelete && (
        <DeleteConfirmModal
          title="Excluir espaço"
          body={
            <>
              Tem certeza que deseja excluir o espaço{' '}
              <span className="font-semibold text-gray-800 dark:text-gray-100">"{confirmDelete}"</span>
              ? Todos os arquivos e pastas dentro dele serão removidos.
            </>
          }
          onConfirm={() => { onDeleteSession(confirmDelete); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </aside>
  );
}
