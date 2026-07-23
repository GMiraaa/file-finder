import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getMyInvites, acceptInvite, declineInvite } from '../services/api';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [invites, setInvites]             = useState([]);

  // ── Toast notifications ───────────────────────────────────────────────────
  const addNotification = useCallback((message, type = 'info') => {
    setNotifications((prev) => [
      { id: Date.now() + Math.random(), message, type, time: new Date() },
      ...prev,
    ]);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  // ── Invites (convites de compartilhamento de espaço) ─────────────────────
  const fetchInvites = useCallback(async () => {
    try {
      const { data } = await getMyInvites();
      setInvites(data.invites || []);
    } catch { /* silent — usuário pode não estar autenticado */ }
  }, []);

  // Busca convites na montagem e a cada 30 segundos
  useEffect(() => {
    fetchInvites();
    const timer = setInterval(fetchInvites, 30_000);
    return () => clearInterval(timer);
  }, [fetchInvites]);

  const respondToInvite = useCallback(async (inviteId, action) => {
    try {
      if (action === 'accept') {
        await acceptInvite(inviteId);
      } else {
        await declineInvite(inviteId);
      }
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.response?.data?.detail || 'Erro ao responder convite.' };
    }
  }, []);

  return (
    <NotificationsContext.Provider value={{
      notifications, addNotification, removeNotification, clearAll,
      invites, fetchInvites, respondToInvite,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
