// src/components/DriveAgent.tsx
import React, { useEffect, useState } from 'react';
import { DriveFile } from '../types/drive';
import { getRecentFiles, searchFiles } from '../services/driveService';

export default function DriveAgent() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function carregarRecentes() {
    setLoading(true);
    setError(null);
    try {
      setFiles(await getRecentFiles());
    } catch {
      setError('Não foi possível carregar os arquivos. Conecte sua conta Google na barra lateral.');
    } finally {
      setLoading(false);
    }
  }

  async function handleBusca(e: React.FormEvent) {
    e.preventDefault();
    if (!busca.trim()) {
      carregarRecentes();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setFiles(await searchFiles(busca.trim()));
    } catch {
      setError('Falha na busca.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarRecentes();
  }, []);

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.title}>Drive Agent</h1>

      <form onSubmit={handleBusca} style={styles.searchBar}>
        <input
          style={styles.input}
          placeholder="Buscar arquivos por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button style={styles.searchButton} type="submit">
          Buscar
        </button>
      </form>

      {error && <p style={styles.error}>{error}</p>}
      {loading && <p style={styles.info}>Carregando...</p>}
      {!loading && files.length === 0 && !error && (
        <p style={styles.info}>Nenhum arquivo encontrado.</p>
      )}

      <div style={styles.list}>
        {files.map((file) => (
          <a
            key={file.id}
            href={file.link}
            target="_blank"
            rel="noreferrer"
            style={styles.fileRow}
          >
            {file.iconeLink ? (
              <img src={file.iconeLink} alt="" style={styles.icone} />
            ) : (
              <div style={styles.iconePlaceholder} />
            )}
            <div style={styles.fileInfo}>
              <span style={styles.fileName}>{file.nome}</span>
              <span style={styles.fileMeta}>{formatarData(file.modificadoEm)}</span>
            </div>
            <span style={styles.abrir}>Abrir ↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { maxWidth: 600, fontFamily: 'system-ui, sans-serif', color: '#e6f7ff' },
  title: { color: '#4fd8ff', marginBottom: 16 },
  searchBar: { display: 'flex', gap: 8, marginBottom: 20 },
  input: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid rgba(0, 200, 255, 0.3)',
    background: 'rgba(255,255,255,0.03)',
    color: '#e6f7ff',
    fontSize: 13,
    outline: 'none',
  },
  searchButton: {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(90deg, #00c8ff, #0072ff)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 13,
  },
  info: { color: '#8fb3c8', fontSize: 13 },
  error: { color: '#ff8080', fontSize: 13 },
  list: { display: 'flex', flexDirection: 'column', gap: 2 },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 8,
    borderBottom: '1px solid rgba(0, 200, 255, 0.08)',
    textDecoration: 'none',
    color: '#e6f7ff',
  },
  icone: { width: 20, height: 20 },
  iconePlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 4,
    background: 'rgba(0, 200, 255, 0.15)',
  },
  fileInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  fileName: { fontSize: 14 },
  fileMeta: { fontSize: 11, color: '#8fb3c8' },
  abrir: { fontSize: 12, color: '#4fd8ff' },
};
