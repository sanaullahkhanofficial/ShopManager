import React, { useState } from "react";
import { money } from "../../lib/format";

// Small, dependency-free chart primitives (plain SVG/CSS, no charting library —
// keeps the offline-first build free of any CDN/network dependency). Built for
// Dashboard v2, reusable by the Reports suite (Phase L).

function roundedTopRectPath(x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h);
  if (h <= 0) return "";
  if (radius <= 0) return `M${x},${y} h${w} v${h} h${-w} Z`;
  return `M${x},${y + h} v${-(h - radius)} a${radius},${radius} 0 0 1 ${radius},${-radius} h${w - 2 * radius} a${radius},${radius} 0 0 1 ${radius},${radius} v${h - radius} Z`;
}

export function TrendBarChart({ data, color = "#1f6b2a", height = 140 }: { data: Array<{ label: string; value: number }>; color?: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 320;
  const padding = { top: 22, bottom: 20, left: 4, right: 4 };
  const plotH = height - padding.top - padding.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const gap = 6;
  const barW = Math.max(6, (width - padding.left - padding.right - gap * (data.length - 1)) / data.length);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#e7e5e4" strokeWidth={1} />
        {data.map((d, i) => {
          const x = padding.left + i * (barW + gap);
          const h = max > 0 ? (d.value / max) * plotH : 0;
          const y = height - padding.bottom - h;
          const isLast = i === data.length - 1;
          const isHover = hover === i;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
              <path d={roundedTopRectPath(x, y, barW, h, 4)} fill={color} opacity={isHover ? 1 : 0.85} />
              <rect x={x} y={padding.top} width={barW} height={height - padding.top - padding.bottom} fill="transparent" />
              {(isLast || isHover) && d.value > 0 && (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={10} fill="#44403c" fontWeight={600}>
                  {d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}K` : d.value}
                </text>
              )}
              <text x={x + barW / 2} y={height - 5} textAnchor="middle" fontSize={9} fill="#a8a29e">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs shadow-md">
          <span className="font-medium text-stone-700">{data[hover].label}: </span>
          <span className="text-brand-green-700">{money(data[hover].value)}</span>
        </div>
      )}
    </div>
  );
}

export function BreakdownDonut({ data, size = 140, centerLabel }: { data: Array<{ label: string; value: number; color: string }>; size?: number; centerLabel?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = size / 2 - 14;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const gapLen = total > 0 ? 3 : 0;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0efec" strokeWidth={16} />
          {total > 0 && data.map((d, i) => {
            const frac = d.value / total;
            const segLen = Math.max(0, frac * circumference - gapLen);
            const dasharray = `${segLen} ${circumference - segLen}`;
            const el = (
              <circle
                key={i}
                cx={cx} cy={cy} r={r} fill="none"
                stroke={d.color} strokeWidth={hover === i ? 19 : 16}
                strokeDasharray={dasharray} strokeDashoffset={-offset}
                transform={`rotate(-90 ${cx} ${cy})`}
                strokeLinecap="butt"
                style={{ cursor: "pointer", transition: "stroke-width 0.1s" }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            );
            offset += frac * circumference;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-semibold text-brand-navy-900">{money(hover != null ? data[hover].value : total)}</span>
          <span className="text-[10px] text-stone-400">{hover != null ? data[hover].label : (centerLabel || "Total")}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {data.map((d, i) => (
          <div
            key={i}
            className={`flex items-center justify-between gap-2 rounded px-1.5 py-0.5 text-xs ${hover === i ? "bg-stone-50" : ""}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="truncate text-stone-600">{d.label}</span>
            </span>
            <span className="shrink-0 font-medium text-stone-700">{total > 0 ? `${Math.round((d.value / total) * 100)}%` : "0%"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SplitBar({ segments, height = 10 }: { segments: Array<{ label: string; value: number; color: string }>; height?: number }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div className="space-y-1.5">
      <div className="flex overflow-hidden rounded-full" style={{ height, gap: total > 0 ? 2 : 0 }}>
        {total > 0 ? segments.map((s, i) => (
          <div key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label}: ${money(s.value)}`} />
        )) : <div className="w-full bg-stone-100" />}
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs">
        {segments.map((s, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="text-stone-500">{s.label}</span>
            <span className="font-medium text-stone-700">{money(s.value)}</span>
            {total > 0 && <span className="text-stone-400">({Math.round((s.value / total) * 100)}%)</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
