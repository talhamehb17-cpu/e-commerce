'use client';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

const AUTO = ['winter','winter','spring','spring','spring','summer','summer','summer','autumn','autumn','autumn','winter'];
export function SeasonalEffects({ config = {} }) {
  const pathname = usePathname();
  const season = useMemo(() => config.automatic ? AUTO[new Date().getMonth()] : config.season, [config.automatic, config.season]);
  if (pathname?.startsWith('/admin') || !config.enabled || !season || season === 'none') return null;
  const count = Math.max(8, Math.min(36, Math.round(Number(config.intensity ?? 35) / 3)));
  const speed = Math.max(.6, Math.min(5, Number(config.speed ?? 2)));
  const kinds = { spring: ['✿','❀','✽'], summer: ['·','✦','•'], autumn: ['🍂','✧','❧'], winter: ['❄','✧','·'], rain: ['│','╱','·'], confetti: ['✦','●','◆'], festive: ['✦','❄','✧'] };
  const glyphs = kinds[season] || kinds.spring;
  const now = new Date();
  const starts = config.starts_at ? new Date(`${config.starts_at}T00:00:00`) : null;
  const ends = config.ends_at ? new Date(`${config.ends_at}T23:59:59`) : null;
  if (starts && now < starts || ends && now > ends) return null;
  return <div className={`seasonal-effects season-${season}`} aria-hidden="true" style={{'--effect-duration':`${14/speed}s`,'--effect-opacity':String(Math.max(.12,Math.min(.55,Number(config.intensity ?? 35)/100)))}}>
    {Array.from({length:count},(_,i)=><i key={i} style={{left:`${(i*37+11)%100}%`,animationDelay:`-${(i*1.73)%(14/speed)}s`,fontSize:`${10+(i*7)%14}px`}}>{glyphs[i%glyphs.length]}</i>)}
  </div>;
}
