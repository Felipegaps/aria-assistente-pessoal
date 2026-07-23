// src/components/EmailAgent.tsx
import React, { useEffect, useState } from 'react';
import { EmailMessage } from '../types/email';
import { getRecentEmails } from '../services/gmailService';
import { connectGoogle, isGoogleConnected } from '../services/googleAuthService';

export default function EmailAgent() {
  const [conectado, setConectado] = useState(isGoogleConnected());
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setError(null);
    try {
      await connectGoogle();
      setConectado(true);
      await handleRefresh();
    } catch {
      setError('Não foi possível conectar ao Gmail.');
    }
  }

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    try {
      const recentes = await getRecentEmails();
      setEmails(recentes);
    } catch {
      setError('Falha ao carregar e-mails.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (conectado) handleRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const naoLidos = emails.filter((e) => !e.lido).length;

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Email Agent</h1>
          {conectado && (
            <span style={styles.subtitle}>
              {naoLidos} não lido{naoLidos !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {!conectado ? (
          <button style={styles.connectButton} onClick={handleConnect}>
            Conectar Gmail
          </button>
        ) : (
          <button style={styles.refreshButton} onClick={handleRefresh}>
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        )}
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {!conectado && !error && (
        <p style={styles.info}>Conecte sua conta Gmail para ver os e-mails recentes.</p>
      )}
      {conectado && !loading && emails.length === 0 && (
        <p style={styles.info}>Nenhum e-mail encontrado.</p>
      )}

      <div style={styles.list}>
        {emails.map((email) => (
          <EmailRow key={email.id} email={email} />
        ))}
      </div>
    </div>
  );
}

function EmailRow({ email }: { email: EmailMessage }) {
  const data = new Date(email.recebidoEm).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });

  return (
    <div style={{ ...styles.row, ...(email.lido ? {} : styles.rowUnread) }}>
      <div style={styles.rowHeader}>
        <span style={styles.remetente}>{extrairNome(email.remetente)}</span>
        <span style={styles.data}>{data}</span>
      </div>
      <span style={styles.assunto}>{email.assunto}</span>
      <span style={styles.resumo}>{email.resumo}</span>
    </div>
  );
}

function extrairNome(remetenteCompleto: string): string {
  // "Nome Sobrenome <email@exemplo.com>" -> "Nome Sobrenome"
  const match = remetenteCompleto.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : remetenteCompleto;
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { maxWidth: 560, fontFamily: 'system-ui, sans-serif', color: '#e6f7ff' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { color: '#4fd8ff', margin: 0 },
  subtitle: { fontSize: 12, color: '#8fb3c8' },
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
  info: { color: '#8fb3c8', fontSize: 13 },
  error: { color: '#ff8080', fontSize: 13 },
  list: { display: 'flex', flexDirection: 'column', gap: 4 },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '10px 12px',
    borderRadius: 8,
    borderBottom: '1px solid rgba(0, 200, 255, 0.08)',
  },
  rowUnread: {
    background: 'rgba(0, 200, 255, 0.05)',
    borderLeft: '2px solid #4fd8ff',
  },
  rowHeader: { display: 'flex', justifyContent: 'space-between' },
  remetente: { fontSize: 13, fontWeight: 600 },
  data: { fontSize: 11, color: '#5a7a8c' },
  assunto: { fontSize: 13 },
  resumo: { fontSize: 12, color: '#8fb3c8' },
};
