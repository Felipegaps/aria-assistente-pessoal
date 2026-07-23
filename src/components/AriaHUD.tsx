// src/components/AriaHUD.tsx
//
// Interface central de chat/voz da ARIA (HUD estilo JARVIS).
// Conecta com o orquestrador processAriaCommand() e suporta entrada por
// texto e por voz (Web Speech API — funciona no Chrome/Android).
//
// A resposta da ARIA agora é falada com uma voz neural (Chirp 3: HD,
// via /api/tts) em vez da voz robótica padrão do navegador.

import React, { useEffect, useRef, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { processAriaCommand, limparHistorico } from '../agents/ariaAgent';
import { UserProfile } from '../types/household';

interface Mensagem {
  autor: 'user' | 'aria';
  texto: string;
}

export default function AriaHUD({ profile }: { profile: UserProfile }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState('');
  const [processando, setProcessando] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [falando, setFalando] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Configura reconhecimento de voz (Web Speech API)
  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const texto = event.results[0][0].transcript;
      setInput(texto);
      enviar(texto);
    };
    recognition.onend = () => setOuvindo(false);
    recognition.onerror = () => setOuvindo(false);

    recognitionRef.current = recognition;
  }, []);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: 'smooth' });
  }, [mensagens, processando]);

  async function enviar(texto?: string) {
    const comando = (texto ?? input).trim();
    if (!comando || processando) return;

    setMensagens((prev) => [...prev, { autor: 'user', texto: comando }]);
    setInput('');
    setProcessando(true);

    try {
      const resposta = await processAriaCommand(comando, profile);
      setMensagens((prev) => [...prev, { autor: 'aria', texto: resposta }]);
      falar(resposta);
    } catch {
      setMensagens((prev) => [
        ...prev,
        { autor: 'aria', texto: 'Desculpe, tive um problema ao processar isso.' },
      ]);
    } finally {
      setProcessando(false);
    }
  }

  // Text-to-speech neural (Chirp 3: HD, via /api/tts). Se a chamada
  // falhar por qualquer motivo, cai de volta na voz do navegador para
  // a ARIA nunca ficar muda.
  async function falar(texto: string) {
    try {
      const user = getAuth().currentUser;
      if (!user) throw new Error('sem usuário');

      const idToken = await user.getIdToken();
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ texto }),
      });

      if (!res.ok) throw new Error(`tts falhou: ${res.status}`);

      const { audioContent } = await res.json();
      if (!audioContent) throw new Error('sem áudio na resposta');

      audioRef.current?.pause();
      const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
      audioRef.current = audio;
      setFalando(true);
      audio.onended = () => setFalando(false);
      audio.onerror = () => setFalando(false);
      await audio.play();
    } catch {
      // Fallback: voz robótica do navegador, só para não ficar em silêncio
      if (window.speechSynthesis) {
        const utter = new SpeechSynthesisUtterance(texto);
        utter.lang = 'pt-BR';
        utter.onstart = () => setFalando(true);
        utter.onend = () => setFalando(false);
        window.speechSynthesis.speak(utter);
      }
    }
  }

  function toggleVoz() {
    if (!recognitionRef.current) return;
    if (ouvindo) {
      recognitionRef.current.stop();
      setOuvindo(false);
    } else {
      recognitionRef.current.start();
      setOuvindo(true);
    }
  }

  async function novaConversa() {
    await limparHistorico(profile.uid);
    setMensagens([]);
  }

  return (
    <div style={styles.wrapper}>
      {/* Núcleo animado da ARIA */}
      <div style={styles.coreArea}>
        <div style={{ ...styles.core, ...(processando || falando ? styles.corePulsing : {}) }}>
          <div style={styles.coreInner} />
        </div>
        <span style={styles.coreLabel}>
          {processando ? 'Processando...' : falando ? 'Falando...' : ouvindo ? 'Ouvindo...' : 'ARIA online'}
        </span>
      </div>

      {/* Histórico de mensagens */}
      <div style={styles.chat} ref={listaRef}>
        {mensagens.length === 0 && (
          <p style={styles.hint}>
            Fale ou digite um comando. Ex: "acende a luz da sala", "o que tenho na agenda amanhã?",
            "adiciona café na lista de casa".
          </p>
        )}
        {mensagens.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.bubble,
              ...(msg.autor === 'user' ? styles.bubbleUser : styles.bubbleAria),
            }}
          >
            {msg.texto}
          </div>
        ))}
        {processando && <div style={{ ...styles.bubble, ...styles.bubbleAria }}>...</div>}
      </div>

      {/* Barra de entrada */}
      <div style={styles.inputBar}>
        <button
          style={{ ...styles.micButton, ...(ouvindo ? styles.micButtonActive : {}) }}
          onClick={toggleVoz}
          title="Falar"
        >
          🎙
        </button>
        <input
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()}
          placeholder="Diga algo à ARIA..."
          disabled={processando}
        />
        <button style={styles.sendButton} onClick={() => enviar()} disabled={processando}>
          Enviar
        </button>
        <button style={styles.clearButton} onClick={novaConversa} title="Nova conversa">
          ↺
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 80px)',
    maxWidth: 720,
    margin: '0 auto',
    fontFamily: 'system-ui, sans-serif',
    color: '#e6f7ff',
  },
  coreArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px 0',
  },
  core: {
    width: 90,
    height: 90,
    borderRadius: '50%',
    border: '2px solid rgba(0, 200, 255, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 30px rgba(0, 200, 255, 0.3), inset 0 0 20px rgba(0, 200, 255, 0.2)',
    transition: 'all 0.3s',
  },
  corePulsing: {
    animation: 'pulse 1s infinite',
    boxShadow: '0 0 50px rgba(0, 200, 255, 0.6), inset 0 0 30px rgba(0, 200, 255, 0.4)',
  },
  coreInner: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'radial-gradient(circle, #4fd8ff, #0072ff)',
  },
  coreLabel: {
    marginTop: 12,
    fontSize: 12,
    color: '#8fb3c8',
    letterSpacing: 1,
  },
  chat: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '16px 8px',
  },
  hint: {
    color: '#5a7a8c',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },
  bubble: {
    maxWidth: '75%',
    padding: '10px 14px',
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    background: 'linear-gradient(90deg, #0072ff, #00c8ff)',
    color: '#fff',
    borderBottomRightRadius: 2,
  },
  bubbleAria: {
    alignSelf: 'flex-start',
    background: 'rgba(10, 25, 40, 0.7)',
    border: '1px solid rgba(0, 200, 255, 0.2)',
    color: '#e6f7ff',
    borderBottomLeftRadius: 2,
  },
  inputBar: {
    display: 'flex',
    gap: 8,
    padding: '12px 8px',
    borderTop: '1px solid rgba(0, 200, 255, 0.15)',
  },
  micButton: {
    width: 42,
    borderRadius: 10,
    border: '1px solid rgba(0, 200, 255, 0.3)',
    background: 'transparent',
    fontSize: 16,
    cursor: 'pointer',
  },
  micButtonActive: {
    background: 'rgba(255, 60, 60, 0.2)',
    borderColor: 'rgba(255, 60, 60, 0.5)',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid rgba(0, 200, 255, 0.3)',
    background: 'rgba(255,255,255,0.03)',
    color: '#e6f7ff',
    fontSize: 14,
    outline: 'none',
  },
  sendButton: {
    padding: '0 18px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(90deg, #00c8ff, #0072ff)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 14,
  },
  clearButton: {
    width: 42,
    borderRadius: 10,
    border: '1px solid rgba(0, 200, 255, 0.3)',
    background: 'transparent',
    color: '#8fb3c8',
    fontSize: 16,
    cursor: 'pointer',
  },
};

// NOTA: adicione esta animação ao seu CSS global (index.css):
//
// @keyframes pulse {
//   0% { transform: scale(1); opacity: 1; }
//   50% { transform: scale(1.08); opacity: 0.8; }
//   100% { transform: scale(1); opacity: 1; }
// }
