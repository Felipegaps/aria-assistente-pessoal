// src/App.tsx
//
// Roteamento, sidebar e conexão Google unificada. Todos os agentes já
// plugados nos seus respectivos destinos.

import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import AuthScreen from './components/AuthScreen';
import AriaHUD from './components/AriaHUD';
import EmailAgent from './components/EmailAgent';
import CalendarAgent from './components/CalendarAgent';
import DriveAgent from './components/DriveAgent';
import ShoppingAgent from './components/ShoppingAgent';
import HomeAgent from './components/HomeAgent';
import { onAuthChange, getUserProfile, logout } from './services/authService';
import { connectGoogle, isGoogleConnected, onGoogleAuthChange } from './services/googleAuthService';
import { UserProfile } from './types/household';

type View = 'home' | 'email' | 'calendar' | 'drive' | 'shopping' | 'house';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [view, setView] = useState<View>('home');
  const [googleConnected, setGoogleConnected] = useState(isGoogleConnected());

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        const p = await getUserProfile(firebaseUser.uid);
        setProfile(p as UserProfile | null);
      } else {
        setProfile(null);
      }

      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Reage a qualquer mudança de estado da conexão Google (conectar/expirar)
  useEffect(() => {
    return onGoogleAuthChange(setGoogleConnected);
  }, []);

  async function handleConnectGoogle() {
    try {
      await connectGoogle();
    } catch {
      // silencioso: cada agente mostra seu próprio erro se tentar usar sem conexão
    }
  }

  if (checkingAuth) {
    return <FullScreenLoader />;
  }

  if (!user) {
    return <AuthScreen onAuthenticated={() => {}} />;
  }

  return (
    <div style={styles.appWrapper}>
      <Sidebar
        currentView={view}
        onChangeView={setView}
        onLogout={logout}
        profile={profile}
        googleConnected={googleConnected}
        onConnectGoogle={handleConnectGoogle}
      />
      <main style={styles.main}>
        <RouterOutlet view={view} profile={profile} />
      </main>
    </div>
  );
}

function RouterOutlet({ view, profile }: { view: View; profile: UserProfile | null }) {
  if (!profile) return null;

  switch (view) {
    case 'home':
      return <AriaHUD profile={profile} />;
    case 'email':
      return <EmailAgent />;
    case 'calendar':
      // TODO: carregar uid/nome do outro membro dinamicamente de households/{id}
      return <CalendarAgent profile={profile} />;
    case 'drive':
      return <DriveAgent />;
    case 'shopping':
      return <ShoppingAgent profile={profile} />;
    case 'house':
  return <HomeAgent profile={profile} />;
    default:
      return null;
  }
}

function Sidebar({
  currentView,
  onChangeView,
  onLogout,
  profile,
  googleConnected,
  onConnectGoogle,
}: {
  currentView: View;
  onChangeView: (v: View) => void;
  onLogout: () => void;
  profile: UserProfile | null;
  googleConnected: boolean;
  onConnectGoogle: () => void;
}) {
  const items: { key: View; label: string }[] = [
    { key: 'home', label: 'Início' },
    { key: 'email', label: 'Email' },
    { key: 'calendar', label: 'Agenda' },
    { key: 'drive', label: 'Drive' },
    { key: 'shopping', label: 'Compras' },
    { key: 'house', label: 'Casa' },
  ];

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logo}>ARIA</div>
      <p style={styles.userLabel}>{profile?.displayName}</p>

      {/* Conexão única com o Google: cobre Calendar, Gmail e Drive de uma vez */}
      <button
        style={{
          ...styles.googleButton,
          ...(googleConnected ? styles.googleButtonConnected : {}),
        }}
        onClick={onConnectGoogle}
        disabled={googleConnected}
      >
        {googleConnected ? '✓ Google conectado' : 'Conectar Google'}
      </button>

      <nav style={styles.nav}>
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => onChangeView(item.key)}
            style={{
              ...styles.navButton,
              ...(currentView === item.key ? styles.navButtonActive : {}),
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <button style={styles.logoutButton} onClick={onLogout}>
        Sair
      </button>
    </aside>
  );
}

function FullScreenLoader() {
  return (
    <div style={styles.loaderWrapper}>
      <span style={styles.loaderText}>Inicializando ARIA...</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  appWrapper: {
    display: 'flex',
    minHeight: '100vh',
    background: '#050b12',
    fontFamily: 'system-ui, sans-serif',
    color: '#e6f7ff',
  },
  sidebar: {
    width: 200,
    background: 'rgba(10, 25, 40, 0.6)',
    borderRight: '1px solid rgba(0, 200, 255, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
  },
  logo: {
    color: '#4fd8ff',
    fontWeight: 700,
    letterSpacing: 3,
    fontSize: 20,
    marginBottom: 4,
  },
  userLabel: {
    color: '#8fb3c8',
    fontSize: 12,
    marginBottom: 16,
  },
  googleButton: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid rgba(0, 200, 255, 0.3)',
    background: 'transparent',
    color: '#8fb3c8',
    fontSize: 12,
    cursor: 'pointer',
    marginBottom: 20,
  },
  googleButtonConnected: {
    background: 'rgba(0, 200, 255, 0.1)',
    color: '#4fd8ff',
    cursor: 'default',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  },
  navButton: {
    textAlign: 'left',
    padding: '10px 12px',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    color: '#a9cbe0',
    fontSize: 14,
    cursor: 'pointer',
  },
  navButtonActive: {
    background: 'rgba(0, 200, 255, 0.12)',
    color: '#4fd8ff',
    fontWeight: 600,
  },
  logoutButton: {
    marginTop: 12,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(255, 100, 100, 0.3)',
    background: 'transparent',
    color: '#ff8080',
    fontSize: 13,
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    padding: 40,
  },
  loaderWrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#050b12',
  },
  loaderText: {
    color: '#4fd8ff',
    fontFamily: 'system-ui, sans-serif',
    letterSpacing: 2,
    fontSize: 14,
  },
};
