'use client';
import { useMemo, useState } from 'react';

/** Lightweight dependency-free SVG charts, animated on mount. */

function extent(values) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  return { max, min };
}

export function AreaChart({ data, xKey = 'date', yKey = 'revenue', height = 220, color = 'var(--accent)', format = (v) => v, compareKey, ariaLabel = 'Trend chart' }) {
  const [hover, setHover] = useState(null);
  const w = 720;
  const h = height;
  const pad = { l: 8, r: 8, t: 14, b: 22 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const values = data.map((d) => Number(d[yKey]) || 0);
  const compareValues = compareKey ? data.map((d) => Number(d[compareKey]) || 0) : [];
  const { max } = extent([...values, ...compareValues]);

  const points = useMemo(
    () => data.map((d, i) => {
      const x = pad.l + (innerW * i) / Math.max(1, data.length - 1);
      const y = pad.t + innerH - (innerH * (Number(d[yKey]) || 0)) / max;
      return { x, y, ...d };
    }),
    [data, yKey, max, innerW, innerH]
  );

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L${points[points.length - 1]?.x || 0},${pad.t + innerH} L${points[0]?.x || 0},${pad.t + innerH} Z`;

  const comparePath = compareKey
    ? data.map((d, i) => {
        const x = pad.l + (innerW * i) / Math.max(1, data.length - 1);
        const y = pad.t + innerH - (innerH * (Number(d[compareKey]) || 0)) / max;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ')
    : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={`grad-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={pad.l} x2={w - pad.r} y1={pad.t + innerH * g} y2={pad.t + innerH * g} stroke="var(--line)" strokeDasharray="3 5" strokeWidth="1" opacity="0.5" />
        ))}
        <path d={area} fill={`url(#grad-${yKey})`} style={{ opacity: 0, animation: 'chartFade .9s .1s forwards' }} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="3000" strokeDashoffset="3000" style={{ animation: 'chartDraw 1.2s ease forwards' }} />
        {comparePath && <path d={comparePath} fill="none" stroke="var(--muted)" strokeWidth="1.4" strokeDasharray="4 4" opacity="0.7" />}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={hover === i ? 4.5 : 0} fill={color} stroke="var(--surface)" strokeWidth="2" />
            <rect
              x={p.x - innerW / Math.max(1, data.length * 2)} y={pad.t} width={innerW / Math.max(1, data.length)} height={innerH}
              fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
        <text x={pad.l} y={h - 4} fill="var(--muted)" fontSize="9">
          {data[0] ? labelDate(data[0][xKey]) : ''}
        </text>
        <text x={w - pad.r} y={h - 4} fill="var(--muted)" fontSize="9" textAnchor="end">
          {data.length ? labelDate(data[data.length - 1][xKey]) : ''}
        </text>
      </svg>
      {hover != null && points[hover] && (
        <div style={{
          position: 'absolute', left: `calc(${(points[hover].x / w) * 100}% - 60px)`, top: 4,
          background: 'var(--ink)', color: 'var(--bg)', borderRadius: 8, padding: '6px 10px', fontSize: 11, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          <div style={{ opacity: 0.7 }}>{labelDate(points[hover][xKey])}</div>
          <strong>{format(points[hover][yKey])}</strong>
        </div>
      )}
      <style>{`
        @keyframes chartDraw { to { stroke-dashoffset: 0 } }
        @keyframes chartFade { to { opacity: 1 } }
        @keyframes barGrow { from { transform: scaleY(0) } to { transform: scaleY(1) } }
        @keyframes ringSpin { from { stroke-dashoffset: 400 } }
      `}</style>
    </div>
  );
}

function labelDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function BarChart({ data, xKey = 'date', yKey = 'orders', height = 180, format = (v) => v, ariaLabel = `${yKey} by date` }) {
  const { max } = extent(data.map((d) => Number(d[yKey]) || 0));
  return (
    <div role="img" aria-label={ariaLabel} style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height, paddingTop: 10 }}>
      {data.map((d, i) => {
        const v = Number(d[yKey]) || 0;
        const pct = (v / max) * 100;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', position: 'relative' }} title={`${labelDate(d[xKey])}: ${format(v)}`}>
            <div style={{
              height: `${Math.max(2, pct)}%`, background: i === data.length - 1 ? 'var(--accent)' : 'color-mix(in srgb,var(--accent) 42%,transparent)',
              borderRadius: '3px 3px 0 0', transformOrigin: 'bottom', animation: `barGrow .7s ${i * 12}ms both`,
            }} />
          </div>
        );
      })}
    </div>
  );
}

export function Donut({ segments, size = 168, thickness = 16, centerLabel, centerValue }) {
  const total = segments.reduce((s, x) => s + (Number(x.value) || 0), 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface2)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const portion = (Number(s.value) || 0) / total;
          const dash = portion * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-acc} strokeLinecap="butt"
              style={{ animation: `ringSpin .9s ${i * 90}ms both` }} />
          );
          acc += dash;
          return el;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 24, lineHeight: 1 }}>{centerValue}</div>
          <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>{centerLabel}</div>
        </div>
      </div>
    </div>
  );
}

export function ProgressRing({ value = 0, size = 108, thickness = 9, label, color = 'var(--accent)' }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface2)" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.22,.8,.24,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: size / 4.6, lineHeight: 1 }}>{pct.toFixed(0)}%</div>
          {label && <div style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 2 }}>{label}</div>}
        </div>
      </div>
    </div>
  );
}

export function MiniSpark({ values = [], width = 72, height = 26, color = 'var(--accent)' }) {
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(width * i) / Math.max(1, values.length - 1)},${height - (height * v) / max}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function HBar({ label, value, max, format = (v) => v, color }) {
  const pct = max ? Math.max(2, (Number(value) / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
        <span>{label}</span>
        <span className="muted">{format(value)}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color || 'var(--accent)', borderRadius: 4, transition: 'width .9s cubic-bezier(.22,.8,.24,1)' }} />
      </div>
    </div>
  );
}
