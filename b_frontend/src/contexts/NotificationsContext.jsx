import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getMyInvites, acceptInvite, declineInvite } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { user }                          = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [invites, setInvites]             = useState([]);
  const abortRef                          = useRef(null);

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

  // ── Invites ───────────────────────────────────────────────────────────────
  const fetchInvites = useCallback(async () => {
    try {
      const { data } = await getMyInvites();
      setInvites(data.invites || []);
    } catch { /* silent — pode não estar autenticado ainda */ }
  }, []);

  // SSE com reconexão automática; polling como fallback se SSE falhar
  useEffect(() => {
    // Limpa dados do usuário anterior sempre que o usuário mudar
    setInvites([]);
    setNotifications([]);

    if (!user) return;

    fetchInvites();

    const token = localStorage.getItem('ff_token');
    if (!token) return;

    let reconnectTimer = null;
    let active = true;
    const controller = new AbortController();
    abortRef.current = controller;

    const connect = async () => {
      try {
        const res = await fetch(
          `/api/spaces/invites/stream?token=${encodeURIComponent(token)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`SSE ${res.status}`);

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop();
          for (const chunk of chunks) {
            if (!chunk.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(chunk.slice(6));
              if (event.type === 'new_invite') fetchInvites();
            } catch { /* JSON inválido */ }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError' || !active) return;
        // Reconecta em 6 s
        reconnectTimer = setTimeout(connect, 6_000);
      }
    };

    connect();

    return () => {
      active = false;
      clearTimeout(reconnectTimer);
      controller.abort();
    };
  }, [fetchInvites, user?.id]);

  const respondToInvite = useCallback(async (inviteId, action) => {
    try {
      if (action === 'accept') await acceptInvite(inviteId);
      else await declineInvite(inviteId);
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
