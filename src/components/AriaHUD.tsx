// src/components/AriaHUD.tsx
//
// Painel de comando da ARIA. Layout em três faixas: telemetria + núcleo,
// transcrição da conversa, e a barra de comando.
//
// Toda a telemetria exibida é real (contagem de mensagens da sessão,
// latência medida da última resposta, voz efetivamente escolhida pelo
// navegador, disponibilidade de microfone, estado da conexão). Nada de
// número decorativo.
//
// O layout e as animações vivem em index.css (classes .hud-* e .core-*),
// o que permite estados de foco, hover, media queries e reduced-motion.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { processAriaCommand, limparHistorico } from '../agents/ariaAgent';
import { UserProfile } from '../types/household';
import AriaCore, { EstadoAria } from './AriaCore';

interface Mensagem {
  autor: 'user' | 'aria';
  texto: string;
  em: number;
}

const ATALHOS = [
  { rotulo: 'Agenda de hoje', comando: 'O que eu tenho na agenda hoje?' },
  { rotulo: 'E-mails recentes', comando: 'Resuma meus e-mails recentes' },
  { rotulo: 'Estado da casa', comando: 'Quais dispositivos estão ligados em casa?' },
  { rotulo: 'Lista de compras', comando: 'O que tem na lista de compras da casa?' },
];

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function horaCurta(ts: number) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Escolhe a melhor voz feminina em português disponível no dispositivo.
function escolherVoz(): SpeechSynthesisVoice | null {
  const vozes = window.speechSynthesis?.getVoices() ?? [];
  const pt = vozes.filter((v) => v.lang?.toLowerCase().startsWith('pt'));
  const pistasFemininas = ['female', 'mulher', 'luciana', 'francisca', 'maria', 'google português'];

  return (
    pt.find((v) => v.name.toLowerCase().includes('google') && !v.name.toLowerCase().includes('male')) ??
    pt.find((v) => pistasFemininas.some((p) => v.name.toLowerCase().includes(p))) ??
    pt[0] ??
    null
  );
}

export default function AriaHUD({ profile }: { profile: UserProfile }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState('');
  const [processando, setProcessando] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [falando, setFalando] = useState(false);
  const [latencia, setLatencia] = useState<number | null>(null);
  const [relogio, setRelogio] = useState(() => new Date());
  const [nomeVoz, setNomeVoz] = useState<string | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);

  const listaRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inicioSessao = useRef(Date.now());

  const microfoneDisponivel = useMemo(
    // @ts-ignore
    () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  );

  const estado: EstadoAria = processando
    ? 'processando'
    : falando
    ? 'falando'
    : ouvindo
    ? 'ouvindo'
    : 'idle';

  // Relógio ao vivo
  useEffect(() => {
    const id = setInterval(() => setRelogio(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Conexão
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // As vozes chegam de forma assíncrona no Chrome — só dá pra saber qual
  // será usada depois que a lista carrega.
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const atualizar = () => {
      const v = escolherVoz();
      setNomeVoz(v ? v.name.replace(/^Microsoft |^Google /, '') : null);
    };
    atualizar();
    window.speechSynthesis.onvoiceschanged = atualizar;
  }, []);

  // Reconhecimento de voz
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

    setMensagens((prev) => [...prev, { autor: 'user', texto: comando, em: Date.now() }]);
    setInput('');
    setProcessando(true);

    const t0 = performance.now();

    try {
      const resposta = await processAriaCommand(comando, profile);
      setLatencia(Math.round(performance.now() - t0));
      setMensagens((prev) => [...prev, { autor: 'aria', texto: resposta, em: Date.now() }]);
      falar(resposta);
    } catch {
      setLatencia(null);
      setMensagens((prev) => [
        ...prev,
        {
          autor: 'aria',
          texto: 'Não consegui completar essa ação. Tente de novo em instantes.',
          em: Date.now(),
        },
      ]);
    } finally {
      setProcessando(false);
    }
  }

  function falar(texto: string) {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = 'pt-BR';
    utter.rate = 1.02;
    utter.pitch = 1.05;

    const voz = escolherVoz();
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
    window.speechSynthesis?.cancel();
    await limparHistorico(profile.uid);
    setMensagens([]);
    setLatencia(null);
  }

  const rotuloEstado =
    estado === 'processando'
      ? 'processando'
      : estado === 'falando'
      ? 'falando'
      : estado === 'ouvindo'
      ? 'ouvindo'
      : 'em espera';

  return (
    <div className="hud">
      <div className="hud-grid" aria-hidden />
      <div className="hud-scan" aria-hidden />

      {/* Barra superior */}
      <header className="hud-bar">
        <div className="hud-brand">
          <span className="hud-brand__mark">A·R·I·A</span>
          <span className="hud-brand__sub">assistente pessoal</span>
        </div>
        <div className="hud-bar__meta">
          <time className="hud-clock">{relogio.toLocaleTimeString('pt-BR')}</time>
          <span className="hud-date">
            {relogio.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
          </span>
        </div>
      </header>

      {/* Palco: telemetria + núcleo */}
      <section className="hud-stage">
        <aside className="hud-rail">
          <h2 className="hud-rail__title">Sessão</h2>
          <Dado rotulo="Mensagens" valor={String(mensagens.length)} />
          <Dado rotulo="Última resposta" valor={latencia !== null ? `${latencia} ms` : '—'} />
          <Dado rotulo="Iniciada" valor={horaCurta(inicioSessao.current)} />
        </aside>

        <div className="hud-core">
          <span className="hud-bracket hud-bracket--tl" />
          <span className="hud-bracket hud-bracket--tr" />
          <span className="hud-bracket hud-bracket--bl" />
          <span className="hud-bracket hud-bracket--br" />

          <AriaCore estado={estado} size={250} />

          <p className="hud-greet">
            {saudacao()}, <strong>{profile.displayName?.split(' ')[0]}</strong>
          </p>

          <div className={`hud-status hud-status--${estado}`}>
            <i className="hud-status__dot" />
            {rotuloEstado}
          </div>

          <div className={`hud-wave hud-wave--${estado}`} aria-hidden>
            {Array.from({ length: 32 }, (_, i) => (
              <span key={i} style={{ animationDelay: `${(i % 8) * 0.07}s` }} />
            ))}
          </div>
        </div>

        <aside className="hud-rail hud-rail--right">
          <h2 className="hud-rail__title">Sistema</h2>
          <Dado rotulo="Conexão" valor={online ? 'online' : 'offline'} alerta={!online} />
          <Dado rotulo="Microfone" valor={microfoneDisponivel ? 'pronto' : 'indisponível'} alerta={!microfoneDisponivel} />
          <Dado rotulo="Voz" valor={nomeVoz ?? 'padrão do sistema'} />
        </aside>
      </section>

      {/* Transcrição */}
      <section className="hud-chat" ref={listaRef}>
        {mensagens.length === 0 ? (
          <div className="hud-empty">
            <p className="hud-empty__title">Diga o que você precisa.</p>
            <p className="hud-empty__text">
              A ARIA acessa sua agenda, seus e-mails, o Drive, as listas de compras da casa e os
              dispositivos conectados. Fale ou escreva — ou comece por um dos atalhos abaixo.
            </p>
          </div>
        ) : (
          mensagens.map((msg, i) => (
            <article key={i} className={`hud-msg hud-msg--${msg.autor}`}>
              <header className="hud-msg__head">
                <span className="hud-msg__who">{msg.autor === 'user' ? 'você' : 'aria'}</span>
                <time className="hud-msg__time">{horaCurta(msg.em)}</time>
              </header>
              <p className="hud-msg__body">{msg.texto}</p>
            </article>
          ))
        )}

        {processando && (
          <article className="hud-msg hud-msg--aria">
            <header className="hud-msg__head">
              <span className="hud-msg__who">aria</span>
            </header>
            <p className="hud-msg__body hud-typing">
              <i /><i /><i />
            </p>
          </article>
        )}
      </section>

      {/* Atalhos */}
      <div className="hud-chips">
        {ATALHOS.map((a) => (
          <button
            key={a.rotulo}
            className="hud-chip"
            onClick={() => enviar(a.comando)}
            disabled={processando}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {/* Barra de comando */}
      <div className="hud-input">
        <button
          className={`hud-mic ${ouvindo ? 'is-on' : ''}`}
          onClick={toggleVoz}
          disabled={!microfoneDisponivel}
          title={microfoneDisponivel ? 'Falar com a ARIA' : 'Microfone indisponível neste navegador'}
          aria-label="Falar com a ARIA"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <line x1="12" y1="18" x2="12" y2="21" />
          </svg>
        </button>

        <input
          className="hud-field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()}
          placeholder="Diga algo à ARIA…"
          disabled={processando}
        />

        <button className="hud-send" onClick={() => enviar()} disabled={processando || !input.trim()}>
          Enviar
        </button>

        <button className="hud-reset" onClick={novaConversa} title="Começar uma conversa nova" aria-label="Nova conversa">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <polyline points="3 4 3 9 8 9" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Dado({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="hud-dado">
      <span className="hud-dado__rotulo">{rotulo}</span>
      <span className={`hud-dado__valor ${alerta ? 'is-alerta' : ''}`}>{valor}</span>
    </div>
  );
}
