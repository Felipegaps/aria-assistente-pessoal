// src/components/HomeAgent.tsx
//
// VERSÃO SEGURA: agora inclui a tela de configuração do Home Assistant.
// A URL e o token são digitados aqui e guardados no Firestore, dentro da
// household — nunca no bundle do site.

import React, { useEffect, useState } from 'react';
import { HomeDeviceState } from '../types/home';
import { getAllDevices, homeActions, initHomeService, invalidarConfigHome } from '../services/homeService';
import { loadHomeConfig, saveHomeConfig } from '../services/homeConfigService';
import { UserProfile } from '../types/household';

const DOMINIOS_SUPORTADOS = ['light', 'switch', 'climate', 'lock', 'fan'];

export default function HomeAgent({ profile }: { profile: UserProfile }) {
  const [devices, setDevices] = useState<HomeDeviceState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configurado, setConfigurado] = useState<boolean | null>(null);
  const [mostrarConfig, setMostrarConfig] = useState(false);

  useEffect(() => {
    initHomeService(profile.householdId);
    verificarConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.householdId]);

  async function verificarConfig() {
    const cfg = await loadHomeConfig(profile.householdId);
    const ok = Boolean(cfg?.url && cfg?.token);
    setConfigurado(ok);
    if (ok) {
      loadDevices();
    } else {
      setLoading(false);
    }
  }

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
        err.message?.includes('não configurado')
          ? err.message
          : 'Não foi possível conectar ao Home Assistant. Verifique se está na mesma rede Wi-Fi de casa.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(device: HomeDeviceState) {
    const entityId = device.entity_id;
    const domain = entityId.split('.')[0];

    if (domain === 'lock') {
      await (device.state === 'locked'
        ? homeActions.destrancar(entityId)
        : homeActions.trancar(entityId));
    } else {
      await (device.state === 'on'
        ? homeActions.desligar(entityId)
        : homeActions.ligar(entityId));
    }

    setTimeout(loadDevices, 500);
  }

  if (configurado === null) {
    return <p style={styles.info}>Carregando...</p>;
  }

  if (!configurado || mostrarConfig) {
    return (
      <ConfigForm
        profile={profile}
        onSalvo={() => {
          setMostrarConfig(false);
          verificarConfig();
        }}
        onCancelar={configurado ? () => setMostrarConfig(false) : undefined}
      />
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <h1 style={styles.title}>Home Agent</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.refreshButton} onClick={() => setMostrarConfig(true)}>
            Configurar
          </button>
          <button style={styles.refreshButton} onClick={loadDevices}>
            Atualizar
          </button>
        </div>
      </div>

      {loading && <p style={styles.info}>Carregando dispositivos...</p>}
      {error && <p style={styles.error}>{error}</p>}

      {!loading && !error && devices.length === 0 && (
        <p style={styles.info}>Nenhum dispositivo compatível encontrado no Home Assistant.</p>
      )}

      <div style={styles.grid}>
        {devices.map((device) => (
          <DeviceCard
            key={device.entity_id}
            device={device}
            onToggle={() => handleToggle(device)}
          />
        ))}
      </div>
    </div>
  );
}

function ConfigForm({
  profile,
  onSalvo,
  onCancelar,
}: {
  profile: UserProfile;
  onSalvo: () => void;
  onCancelar?: () => void;
}) {
  const [url, setUrl] = useState('https://homeassistant.local:8123');
  const [token, setToken] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    loadHomeConfig(profile.householdId).then((cfg) => {
      if (cfg?.url) setUrl(cfg.url);
      // o token não é pré-preenchido de propósito: se quiser trocar,
      // digita de novo; se deixar em branco, mantém o que já existe
    });
  }, [profile.householdId]);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || !token.trim()) {
      setErro('Preencha a URL e o token.');
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      await saveHomeConfig(profile.householdId, url, token);
      invalidarConfigHome();
      onSalvo();
    } catch {
      setErro('Não foi possível salvar a configuração.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.title}>Configurar Home Assistant</h1>
      <p style={styles.explicacao}>
        A URL e o token ficam guardados na sua household, acessíveis só por quem está
        autenticado. Gere o token no Home Assistant em Perfil &gt; Segurança &gt; Tokens de
        acesso de longa duração.
      </p>

      <form onSubmit={handleSalvar} style={styles.form}>
        <label style={styles.label}>URL do Home Assistant</label>
        <input
          style={styles.input}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://homeassistant.local:8123"
        />

        <label style={styles.label}>Long-Lived Access Token</label>
        <input
          style={styles.input}
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Cole o token aqui"
        />

        {erro && <p style={styles.error}>{erro}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button style={styles.saveButton} type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          {onCancelar && (
            <button style={styles.refreshButton} type="button" onClick={onCancelar}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <p style={styles.aviso}>
        O app roda em HTTPS, então o Home Assistant também precisa estar em https:// — o
        navegador bloqueia chamadas para http:// simples.
      </p>
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
      <button style={{ ...styles.toggle, ...(ligado ? styles.toggleOn : {}) }} onClick={onToggle}>
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { color: '#4fd8ff', margin: 0, marginBottom: 12 },
  explicacao: { fontSize: 13, color: '#8fb3c8', marginBottom: 20, lineHeight: 1.5 },
  aviso: { fontSize: 12, color: '#5a7a8c', marginTop: 20, lineHeight: 1.5 },
  form: { display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 420 },
  label: { fontSize: 12, color: '#8fb3c8', marginTop: 8 },
  input: {
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid rgba(0, 200, 255, 0.3)',
    background: 'rgba(255,255,255,0.03)',
    color: '#e6f7ff',
    fontSize: 13,
    outline: 'none',
  },
  saveButton: {
    padding: '9px 18px',
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
