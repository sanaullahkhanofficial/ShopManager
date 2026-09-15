import React from "react";

// Stylized wheat-field horizon used behind the hero top bar's right-hand
// panel. Entirely code-generated (gradients + simple wheat-ear glyphs) so it
// renders identically offline with zero licensing risk — a placeholder for
// real business photography per the owner's decision, swapped out later.
export function WheatFieldBackdrop({ className = "" }: { className?: string }) {
  return (
    <svg className={`absolute inset-0 h-full w-full ${className}`} viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sm-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cfe3f0" />
          <stop offset="55%" stopColor="#eaf1da" />
          <stop offset="100%" stopColor="#e8cf7c" />
        </linearGradient>
        <linearGradient id="sm-field" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d9b64a" />
          <stop offset="100%" stopColor="#a97f28" />
        </linearGradient>
      </defs>
      <rect width="400" height="100" fill="url(#sm-sky)" />
      <path d="M0,55 L40,45 L90,58 L140,42 L190,56 L240,44 L290,58 L340,46 L400,55 L400,100 L0,100 Z" fill="#8a9a6b" opacity="0.45" />
      <path d="M0,72 Q100,58 200,70 T400,68 L400,100 L0,100 Z" fill="url(#sm-field)" />
      {Array.from({ length: 16 }).map((_, i) => {
        const x = 6 + i * 26 + (i % 2 ? 6 : 0);
        const y = 80 - (i % 3) * 3;
        return (
          <g key={i} transform={`translate(${x},${y}) rotate(${-6 + (i % 5) * 3})`}>
            <line x1="0" y1="0" x2="0" y2="16" stroke="#7a5c22" strokeWidth="1" />
            <ellipse cx="0" cy="-1" rx="2" ry="4.5" fill="#f0d878" />
          </g>
        );
      })}
    </svg>
  );
}
