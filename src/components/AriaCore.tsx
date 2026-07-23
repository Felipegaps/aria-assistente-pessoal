// src/components/AriaCore.tsx
//
// Núcleo holográfico da ARIA — desenhado em SVG, em camadas independentes
// que giram em velocidades e direções diferentes. Nunca fica estático.
//
// As animações vivem em index.css (classes .core-*), o que permite
// respeitar prefers-reduced-motion e trocar o ritmo por estado sem
// recriar nada em JavaScript.

import React from 'react';

export type EstadoAria = 'idle' | 'ouvindo' | 'processando' | 'falando';

// 72 marcações ao redor do núcleo, a cada 5° — as de 30 em 30 são maiores,
// criando uma leitura de escala em vez de um anel liso.
const TICKS = Array.from({ length: 72 }, (_, i) => {
  const principal = i % 6 === 0;
  return { angulo: i * 5, comprimento: principal ? 9 : 4, opacidade: principal ? 0.75 : 0.28 };
});

// Segmentos do anel externo: arcos interrompidos, como um instrumento real
const SEGMENTOS = [
  { inicio: 8, fim: 74 },
  { inicio: 96, fim: 138 },
  { inicio: 188, fim: 250 },
  { inicio: 272, fim: 320 },
];

function arco(cx: number, cy: number, raio: number, grausInicio: number, grausFim: number) {
  const rad = (g: number) => ((g - 90) * Math.PI) / 180;
  const x1 = cx + raio * Math.cos(rad(grausInicio));
  const y1 = cy + raio * Math.sin(rad(grausInicio));
  const x2 = cx + raio * Math.cos(rad(grausFim));
  const y2 = cy + raio * Math.sin(rad(grausFim));
  const arcoLongo = grausFim - grausInicio > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${raio} ${raio} 0 ${arcoLongo} 1 ${x2} ${y2}`;
}

export default function AriaCore({
  estado = 'idle',
  size = 260,
}: {
  estado?: EstadoAria;
  size?: number;
}) {
  return (
    <svg
      className={`core core--${estado}`}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label={`Núcleo da ARIA — ${estado}`}
    >
      <defs>
        <radialGradient id="corePlasma" cx="38%" cy="32%">
          <stop offset="0%" stopColor="#eafcff" />
          <stop offset="35%" stopColor="#7fe7ff" />
          <stop offset="72%" stopColor="#0f7bd6" />
          <stop offset="100%" stopColor="#052a55" />
        </radialGradient>

        <radialGradient id="coreHalo" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#4fd8ff" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#4fd8ff" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#4fd8ff" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="coreArco" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4fd8ff" />
          <stop offset="100%" stopColor="#7c5cff" />
        </linearGradient>

        <filter id="coreGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="coreGlowSoft" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* Halo ambiente */}
      <circle cx="100" cy="100" r="96" fill="url(#coreHalo)" />

      {/* Régua de marcações — gira devagar, dá a sensação de instrumento */}
      <g className="core-ticks">
        {TICKS.map((t) => (
          <line
            key={t.angulo}
            x1="100"
            y1={100 - 94}
            x2="100"
            y2={100 - 94 + t.comprimento}
            stroke="#4fd8ff"
            strokeOpacity={t.opacidade}
            strokeWidth="1"
            transform={`rotate(${t.angulo} 100 100)`}
          />
        ))}
      </g>

      {/* Arcos segmentados — contra-rotação */}
      <g className="core-segments" filter="url(#coreGlow)">
        {SEGMENTOS.map((s, i) => (
          <path
            key={i}
            d={arco(100, 100, 80, s.inicio, s.fim)}
            fill="none"
            stroke="url(#coreArco)"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.85"
          />
        ))}
      </g>

      {/* Anel tracejado interno */}
      <circle
        className="core-dashed"
        cx="100"
        cy="100"
        r="66"
        fill="none"
        stroke="#7c5cff"
        strokeOpacity="0.4"
        strokeWidth="1"
        strokeDasharray="2 7"
      />

      {/* Anel de progresso contínuo, some e volta */}
      <circle
        className="core-sweep"
        cx="100"
        cy="100"
        r="55"
        fill="none"
        stroke="#4fd8ff"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="120 226"
        opacity="0.7"
      />

      {/* Malha hexagonal sutil atrás do núcleo */}
      <g className="core-mesh" opacity="0.35">
        <polygon
          points="100,62 133,81 133,119 100,138 67,119 67,81"
          fill="none"
          stroke="#4fd8ff"
          strokeOpacity="0.3"
          strokeWidth="0.8"
        />
        <polygon
          points="100,72 124,86 124,114 100,128 76,114 76,86"
          fill="none"
          stroke="#7c5cff"
          strokeOpacity="0.25"
          strokeWidth="0.8"
        />
      </g>

      {/* Nós orbitando em raios e velocidades diferentes */}
      <g className="core-orbit core-orbit--a">
        <circle cx="100" cy="14" r="2.6" fill="#4fd8ff" filter="url(#coreGlow)" />
      </g>
      <g className="core-orbit core-orbit--b">
        <circle cx="100" cy="28" r="2" fill="#7c5cff" filter="url(#coreGlow)" />
      </g>
      <g className="core-orbit core-orbit--c">
        <circle cx="100" cy="40" r="1.6" fill="#9ff3ff" filter="url(#coreGlow)" />
      </g>

      {/* Brilho difuso do núcleo */}
      <circle className="core-bloom" cx="100" cy="100" r="30" fill="#4fd8ff" filter="url(#coreGlowSoft)" opacity="0.5" />

      {/* Núcleo: respira e muda de forma continuamente */}
      <ellipse className="core-plasma" cx="100" cy="100" rx="26" ry="26" fill="url(#corePlasma)" />

      {/* Reflexo de vidro */}
      <ellipse cx="92" cy="90" rx="9" ry="6" fill="#ffffff" opacity="0.28" transform="rotate(-28 92 90)" />

      {/* Retículo */}
      <g stroke="#4fd8ff" strokeOpacity="0.3" strokeWidth="0.8">
        <line x1="100" y1="6" x2="100" y2="16" />
        <line x1="100" y1="184" x2="100" y2="194" />
        <line x1="6" y1="100" x2="16" y2="100" />
        <line x1="184" y1="100" x2="194" y2="100" />
      </g>
    </svg>
  );
}
