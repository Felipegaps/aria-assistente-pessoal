// src/components/AuthScreen.tsx
import React, { useState } from 'react';
import { login, registerUser } from '../services/authService';

type Mode = 'login' | 'register';

export default function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [householdId, setHouseholdId] = useState(''); // código de convite (opcional)
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await registerUser(
          email,
          password,
          displayName,
          householdId.trim() ? householdId.trim() : undefined
        );
      }
      onAuthenticated();
    } catch (err: any) {
      setError(traduzErro(err?.code) ?? 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h1 style={styles.title}>ARIA</h1>
        <p style={styles.subtitle}>
          {mode === 'login' ? 'Acesse sua central' : 'Crie seu acesso'}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'register' && (
            <input
              style={styles.input}
              type="text"
              placeholder="Seu nome"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          )}

          <input
            style={styles.input}
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            style={styles.input}
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          {mode === 'register' && (
            <input
              style={styles.input}
              type="text"
              placeholder="Código da casa (deixe em branco para criar uma nova)"
              value={householdId}
              onChange={(e) => setHouseholdId(e.target.value)}
            />
          )}

          {error && <p style={styles.error}>{error}</p>}

          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button
          style={styles.switchButton}
          onClick={() => {
            setError(null);
            setMode(mode === 'login' ? 'register' : 'login');
          }}
        >
          {mode === 'login'
            ? 'Não tem conta? Criar uma'
            : 'Já tem conta? Entrar'}
        </button>
      </div>
    </div>
  );
}

function traduzErro(code?: string): string | null {
  switch (code) {
    case 'auth/invalid-email':
      return 'E-mail inválido.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos.';
    case 'auth/email-already-in-use':
      return 'Esse e-mail já está cadastrado.';
    case 'auth/weak-password':
      return 'A senha precisa ter pelo menos 6 caracteres.';
    default:
      return null;
  }
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle at center, #0a1a2a 0%, #050b12 100%)',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    width: 340,
    padding: '32px 28px',
    borderRadius: 16,
    background: 'rgba(10, 25, 40, 0.7)',
    border: '1px solid rgba(0, 200, 255, 0.25)',
    boxShadow: '0 0 40px rgba(0, 200, 255, 0.15)',
    textAlign: 'center',
  },
  title: {
    color: '#4fd8ff',
    letterSpacing: 4,
    fontSize: 28,
    margin: 0,
  },
  subtitle: {
    color: '#8fb3c8',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 24,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  input: {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(0, 200, 255, 0.3)',
    background: 'rgba(255,255,255,0.03)',
    color: '#e6f7ff',
    fontSize: 14,
    outline: 'none',
  },
  button: {
    marginTop: 8,
    padding: '10px 12px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(90deg, #00c8ff, #0072ff)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    color: '#ff6b6b',
    fontSize: 12,
    margin: 0,
  },
  switchButton: {
    marginTop: 18,
    background: 'none',
    border: 'none',
    color: '#4fd8ff',
    fontSize: 12,
    cursor: 'pointer',
  },
};
