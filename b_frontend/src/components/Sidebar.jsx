import { useEffect, useRef, useState } from 'react';
import { HardDrive, Plus, Clock, FolderOpen, Check, X, Settings2, ChevronDown, Users, Trash2 } from 'lucide-react';
import SpaceSettingsModal from './SpaceSettingsModal';

function _fmtBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)   return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function Sidebar({
  activeView,
  onViewChange,
  fileCount,
  onUploadClick,
  sessions,
  sharedSpaces,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
  onNotify,
  storageInfo = null,
  trashCount = 0,
}) {
  const [newName, setNewName]             = useState('');
  const [showNew, setShowNew]             = useState(false);
  // settings modal
  const [settingsSpace, setSettingsSpace] = useState(null);
  const menuRef                           = useRef(null);
  // collapse
  const [mySpacesOpen, setMySpacesOpen]   = useState(true);
  const [sharedOpen, setSharedOpen]       = useState(true);

  const navItems = [
    { id: 'all',    icon: HardDrive, label: 'Meus Arquivos', count: fileCount },
    { id: 'recent', icon: Clock,     label: 'Recentes' },
    { id: 'trash',  icon: Trash2,    label: 'Lixeira',        count: trashCount || undefined },
  ];

  const handleCreate = (e) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (trimmed) { onCreateSession(trimmed); setNewName(''); setShowNew(false); }
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
                return (
                  <div key={session.name} className="relative group/item">
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
                      {/* Ícone de engrenagem — oculto para Geral */}
                      {session.name !== 'Geral' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSettingsSpace(session.name); }}
                          className="flex-shrink-0 p-1 rounded-full opacity-0 group-hover/item:opacity-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                          title="Configurações do espaço"
                        >
                          <Settings2 className="w-3 h-3 text-gray-500" />
                        </button>
                      )}
                    </button>
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
          <div className="collapsible-inner">
            {sharedSpaces && sharedSpaces.length > 0 ? (
              <div className="space-y-0.5">
                {sharedSpaces.map((s) => {
                  const viewKey = `__shared__/${s.owner_id}/${s.space_name}`;
                  const isActive = activeView === viewKey;
                  return (
                    <button
                      key={viewKey}
                      onClick={() => onViewChange(viewKey)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-full text-sm transition-colors ${
                        isActive
                          ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 font-semibold'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Users className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-teal-500' : 'text-gray-400 dark:text-gray-500'}`} />
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-xs truncate">{s.space_name}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{s.owner_username}</p>
                      </div>
                      {s.file_count > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          isActive ? 'bg-teal-200 dark:bg-teal-800 text-teal-700 dark:text-teal-300'
                                   : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}>{s.file_count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800/50 text-center">
                <Users className="w-5 h-5 text-gray-300 dark:text-gray-600 mx-auto mb-1" />
                <p className="text-[11px] text-gray-400 dark:text-gray-600">
                  Nenhum espaço compartilhado com você ainda.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rodapé — armazenamento */}
      <div className="mt-auto px-4 py-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {storageInfo && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {_fmtBytes(storageInfo.used_bytes)} / {_fmtBytes(storageInfo.quota_bytes)}
              </span>
              <span className={`text-[10px] font-semibold ${
                storageInfo.percent >= 90 ? 'text-red-500' :
                storageInfo.percent >= 70 ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'
              }`}>{storageInfo.percent}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  storageInfo.percent >= 90 ? 'bg-red-500' :
                  storageInfo.percent >= 70 ? 'bg-amber-400' : 'bg-blue-500'
                }`}
                style={{ width: `${storageInfo.percent}%` }}
              />
            </div>
          </div>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
          {fileCount} {fileCount === 1 ? 'arquivo armazenado' : 'arquivos armazenados'}
        </p>
      </div>

      {/* Modal de configurações do espaço */}
      {settingsSpace && (
        <SpaceSettingsModal
          spaceName={settingsSpace}
          onClose={() => setSettingsSpace(null)}
          onRenamed={(oldName, newName) => {
            setSettingsSpace(null);
            onRenameSession?.(oldName, newName);
          }}
          onDeleted={(name) => {
            setSettingsSpace(null);
            onDeleteSession?.(name);
          }}
          onNotify={onNotify}
        />
      )}
    </aside>
  );
}
