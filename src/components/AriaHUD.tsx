// src/components/AriaHUD.tsx
//
// Interface central de chat/voz da ARIA (HUD estilo JARVIS).
// Conecta com o orquestrador processAriaCommand() e suporta entrada por
// texto e por voz (Web Speech API — funciona no Chrome/Android).
//
// O núcleo holográfico (classes aria-* definidas em index.css) está
// sempre em movimento — nunca fica estático — e muda de ritmo/cor
// conforme o estado: ocioso, ouvindo, processando ou falando.
//
// A fala usa a voz do navegador (100% grátis), escolhendo automaticamente
// a melhor voz feminina em português disponível no dispositivo.

import React, { useEffect, useRef, useState } from 'react';
import { processAriaCommand, limparHistorico } from '../agents/ariaAgent';
import { UserProfile } from '../types/household';

interface Mensagem {
  autor: 'user' | 'aria';
  texto: string;
}

function saudacaoPorHorario(): string {
  const hora = new Date().getHours();
  if (hora < 5) return 'Boa madrugada';
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Escolhe a melhor voz feminina em português disponível no navegador.
// Prioriza vozes "Google" (as que soam mais naturais no Chrome/Android),
// depois qualquer voz pt-BR/pt-PT com indício de ser feminina pelo nome.
function escolherMelhorVozFeminina(): SpeechSynthesisVoice | null {
  const vozes = window.speechSynthesis?.getVoices() ?? [];
  const candidatasPt = vozes.filter((v) => v.lang?.toLowerCase().startsWith('pt'));

  const nomesFemininos = ['female', 'mulher', 'luciana', 'francisca', 'maria', 'google português'];

  const preferida =
    candidatasPt.find(
      (v) => v.name.toLowerCase().includes('google') && !v.name.toLowerCase().includes('male')
    ) ??
    candidatasPt.find((v) => nomesFemininos.some((nome) => v.name.toLowerCase().includes(nome))) ??
    candidatasPt[0] ??
    null;

  return preferida;
}

export default function AriaHUD({ profile }: { profile: UserProfile }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState('');
  const [processando, setProcessando] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [falando, setFalando] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Algumas vozes só ficam disponíveis depois que o navegador carrega a
  // lista de forma assíncrona — isso força esse carregamento cedo.
  useEffect(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }, []);

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

  // Text-to-speech 100% gratuito, usando a voz do navegador — mas
  // escolhendo a melhor voz feminina em português disponível, em vez da
  // voz padrão (que costuma soar mais robótica).
  function falar(texto: string) {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = 'pt-BR';
    utter.rate = 1.02;
    utter.pitch = 1.05;

    const voz = escolherMelhorVozFeminina();
    if (voz) utter.voice = voz;

    utter.onstart = () => setFalando(true);
    utter.onend = () => setFalando(false);
    utter.onerror = () => setFalando(false);

    window.speechSynthesis.speak(utter);
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
      <div className="aria-scanline" />

      {/* Núcleo holográfico — sempre em movimento, muda de ritmo/cor por estado */}
      <div style={styles.coreArea}>
        <div
          className={
            'aria-core-stage' +
            (ouvindo ? ' is-listening' : '') +
            (processando ? ' is-processing' : '') +
            (falando ? ' is-speaking' : '')
          }
        >
          <div className="aria-ring aria-ring--outer" />
          <div className="aria-ring aria-ring--middle" />
          <div className="aria-ring aria-ring--inner" />
          <div className="aria-particle" />
          <div className="aria-particle" />
          <div className="aria-particle" />
          <div className="aria-core-blob" />
        </div>

        <p className="font-display" style={styles.greeting}>
          {saudacaoPorHorario()}, {profile.displayName?.split(' ')[0]}
        </p>
        <span className="font-mono" style={styles.coreLabel}>
          {processando ? 'processando' : falando ? 'falando' : ouvindo ? 'ouvindo' : 'aria online'}
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
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 80px)',
    maxWidth: 720,
    margin: '0 auto',
    fontFamily: 'system-ui, sans-serif',
    color: '#e6f7ff',
    overflow: 'hidden',
  },
  coreArea: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 0 16px',
  },
  greeting: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: 600,
    color: '#e6f7ff',
  },
  coreLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#7fa8bc',
    letterSpacing: 2,
    textTransform: 'uppercase',
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
