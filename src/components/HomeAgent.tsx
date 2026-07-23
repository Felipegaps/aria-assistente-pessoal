// src/components/HomeAgent.tsx
import React, { useEffect, useState } from 'react';
import { HomeDeviceState } from '../types/home';
import { getAllDevices, homeActions } from '../services/homeService';

const DOMINIOS_SUPORTADOS = ['light', 'switch', 'climate', 'lock', 'fan'];

export default function HomeAgent() {
  const [devices, setDevices] = useState<HomeDeviceState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDevices() {
    setLoading(true);
    setError(null);
    try {
      const all = await getAllDevices();
      const relevantes = all.filter((d) =>
        DOMINIOS_SUPORTADOS.includes(d.entity_id.split('.')[0])
      );
      setDevices(relevantes);
    } catch (err: any) {
      setError(
        'Não foi possível conectar ao Home Assistant. Verifique se está na mesma rede Wi-Fi de casa.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDevices();
  }, []);

  async function handleToggle(device: HomeDeviceState) {
    const entityId = device.entity_id;
    const domain = entityId.split('.')[0];

    if (domain === 'lock') {
      await (device.state === 'locked' ? homeActions.destrancar(entityId) : homeActions.trancar(entityId));
    } else {
      await (device.state === 'on' ? homeActions.desligar(entityId) : homeActions.ligar(entityId));
    }

    // pequena espera antes de recarregar o estado real do HA
    setTimeout(loadDevices, 500);
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <h1 style={styles.title}>Home Agent</h1>
        <button style={styles.refreshButton} onClick={loadDevices}>
          Atualizar
        </button>
      </div>

      {loading && <p style={styles.info}>Carregando dispositivos...</p>}
      {error && <p style={styles.error}>{error}</p>}

      {!loading && !error && devices.length === 0 && (
        <p style={styles.info}>Nenhum dispositivo compatível encontrado no Home Assistant.</p>
      )}

      <div style={styles.grid}>
        {devices.map((device) => (
          <DeviceCard key={device.entity_id} device={device} onToggle={() => handleToggle(device)} />
        ))}
      </div>
    </div>
  );
}

function DeviceCard({ device, onToggle }: { device: HomeDeviceState; onToggle: () => void }) {
  const isLock = device.entity_id.startsWith('lock.');
  const ligado = isLock ? device.state === 'locked' : device.state === 'on';

  return (
    <div style={styles.card}>
      <div style={styles.cardInfo}>
        <span style={styles.deviceName}>{device.friendly_name}</span>
        <span style={styles.deviceState}>{traduzEstado(device.state)}</span>
      </div>
      <button
        style={{ ...styles.toggle, ...(ligado ? styles.toggleOn : {}) }}
        onClick={onToggle}
      >
        {isLock ? (ligado ? 'Trancado' : 'Destrancado') : ligado ? 'Ligado' : 'Desligado'}
      </button>
    </div>
  );
}

function traduzEstado(state: string): string {
  const map: Record<string, string> = {
    on: 'Ligado',
    off: 'Desligado',
    locked: 'Trancado',
    unlocked: 'Destrancado',
    unavailable: 'Indisponível',
  };
  return map[state] ?? state;
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { maxWidth: 640, fontFamily: 'system-ui, sans-serif', color: '#e6f7ff' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: '#4fd8ff', margin: 0 },
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 12,
  },
  card: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    borderRadius: 10,
    border: '1px solid rgba(0, 200, 255, 0.15)',
    background: 'rgba(10, 25, 40, 0.5)',
  },
  cardInfo: { display: 'flex', flexDirection: 'column', gap: 2 },
  deviceName: { fontSize: 14 },
  deviceState: { fontSize: 11, color: '#8fb3c8' },
  toggle: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid rgba(0, 200, 255, 0.3)',
    background: 'transparent',
    color: '#8fb3c8',
    fontSize: 12,
    cursor: 'pointer',
  },
  toggleOn: {
    background: 'rgba(0, 200, 255, 0.15)',
    color: '#4fd8ff',
    fontWeight: 600,
  },
};
