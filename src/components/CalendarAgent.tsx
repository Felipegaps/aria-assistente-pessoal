// src/components/CalendarAgent.tsx
import React, { useEffect, useState } from 'react';
import { CalendarEvent } from '../types/calendar';
import { getCachedEvents, syncCalendarToCache } from '../services/calendarService';
import { connectGoogle, isGoogleConnected } from '../services/googleAuthService';
import { UserProfile } from '../types/household';

// membros da household que não são o usuário logado (esposa, no seu caso)
// numa versão futura isso pode vir de households/{id}.members carregado dinamicamente
export default function CalendarAgent({
  profile,
  outroMembroUid,
  outroMembroNome,
}: {
  profile: UserProfile;
  outroMembroUid?: string;
  outroMembroNome?: string;
}) {
  const [aba, setAba] = useState<'minha' | 'dela'>('minha');
  const [eventos, setEventos] = useState<CalendarEvent[]>([]);
  const [conectado, setConectado] = useState(isGoogleConnected());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setError(null);
    try {
      await connectGoogle();
      setConectado(true);
      await handleSync();
    } catch {
      setError('Não foi possível conectar ao Google Calendar.');
    }
  }

  async function handleSync() {
    setLoading(true);
    setError(null);
    try {
      await syncCalendarToCache(profile.uid, profile.displayName);
      await carregarAba('minha');
    } catch {
      setError('Falha ao sincronizar a agenda.');
    } finally {
      setLoading(false);
    }
  }

  async function carregarAba(qual: 'minha' | 'dela') {
    setAba(qual);
    setLoading(true);
    try {
      const uidAlvo = qual === 'minha' ? profile.uid : outroMembroUid;
      if (!uidAlvo) {
        setEventos([]);
        return;
      }
      const cached = await getCachedEvents(uidAlvo);
      setEventos(ordenarPorData(cached));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarAba('minha');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <h1 style={styles.title}>Calendar Agent</h1>
        {!conectado ? (
          <button style={styles.connectButton} onClick={handleConnect}>
            Conectar Google Calendar
          </button>
        ) : (
          <button style={styles.refreshButton} onClick={handleSync}>
            {loading ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        )}
      </div>

      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(aba === 'minha' ? styles.tabActive : {}) }}
          onClick={() => carregarAba('minha')}
        >
          Minha agenda
        </button>
        {outroMembroUid && (
          <button
            style={{ ...styles.tab, ...(aba === 'dela' ? styles.tabActive : {}) }}
            onClick={() => carregarAba('dela')}
          >
            Agenda de {outroMembroNome}
          </button>
        )}
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {loading && <p style={styles.info}>Carregando...</p>}

      {!loading && eventos.length === 0 && (
        <p style={styles.info}>Nenhum evento nos próximos 30 dias.</p>
      )}

      <div style={styles.list}>
        {eventos.map((ev) => (
          <EventRow key={ev.id} evento={ev} />
        ))}
      </div>
    </div>
  );
}

function EventRow({ evento }: { evento: CalendarEvent }) {
  const inicio = new Date(evento.inicio);
  const dataFormatada = evento.diaTodo
    ? inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : inicio.toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });

  return (
    <div style={styles.row}>
      <span style={styles.eventDate}>{dataFormatada}</span>
      <div style={styles.eventInfo}>
        <span style={styles.eventTitle}>{evento.titulo}</span>
        {evento.local && <span style={styles.eventLocal}>{evento.local}</span>}
      </div>
    </div>
  );
}

function ordenarPorData(eventos: CalendarEvent[]) {
  return [...eventos].sort(
    (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime()
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { maxWidth: 560, fontFamily: 'system-ui, sans-serif', color: '#e6f7ff' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: '#4fd8ff', margin: 0 },
  connectButton: {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(90deg, #00c8ff, #0072ff)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 13,
  },
  refreshButton: {
    padding: '6px 14px',
    borderRadius: 8,
    border: '1px solid rgba(0, 200, 255, 0.3)',
    background: 'transparent',
    color: '#8fb3c8',
    fontSize: 12,
    cursor: 'pointer',
  },
  tabs: { display: 'flex', gap: 8, marginBottom: 16 },
  tab: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid rgba(0, 200, 255, 0.25)',
    background: 'transparent',
    color: '#8fb3c8',
    cursor: 'pointer',
    fontSize: 13,
  },
  tabActive: {
    background: 'rgba(0, 200, 255, 0.12)',
    color: '#4fd8ff',
    fontWeight: 600,
  },
  info: { color: '#8fb3c8', fontSize: 13 },
  error: { color: '#ff8080', fontSize: 13 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: {
    display: 'flex',
    gap: 12,
    padding: '10px 0',
    borderBottom: '1px solid rgba(0, 200, 255, 0.08)',
  },
  eventDate: { fontSize: 12, color: '#4fd8ff', minWidth: 90 },
  eventInfo: { display: 'flex', flexDirection: 'column', gap: 2 },
  eventTitle: { fontSize: 14 },
  eventLocal: { fontSize: 11, color: '#8fb3c8' },
};
