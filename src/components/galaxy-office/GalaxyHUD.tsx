'use client';

import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TITLE = 'GALAXY COMMAND CENTER';
const font = "'JetBrains Mono', monospace";
const cyan = '#00e5ff';
const dim = '#5e6e85';
const text = '#c8d6e5';

type Props = {
  totalAgents: number;
  activeAgents: number;
  degraded: boolean;
  syncing: boolean;
  error: string | null;
  onCleanup: () => void;
};

export function GalaxyHUD({ totalAgents, activeAgents, degraded, syncing, error, onCleanup }: Props) {
  const titleRef = useRef<HTMLSpanElement>(null);
  const tickerRef = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState('');

  // Clock - WIB (UTC+7)
  useEffect(() => {
    const tick = () => {
      const now = new Date(Date.now() + 7 * 3600000 + new Date().getTimezoneOffset() * 60000);
      setClock(now.toTimeString().slice(0, 8) + ' WIB');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Scramble text effect
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const tl = gsap.timeline();
    let frame = 0;
    const scramble = { id: 0 };

    scramble.id = window.setInterval(() => {
      el.textContent = TITLE.split('').map(() => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
      frame++;
      if (frame > 30) clearInterval(scramble.id);
    }, 50);

    tl.to({}, {
      duration: 1.5,
      onUpdate() {
        const p = this.progress();
        const reveal = Math.floor(p * TITLE.length);
        el.textContent = TITLE.slice(0, reveal) +
          TITLE.slice(reveal).split('').map(() => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
      },
      onComplete() { clearInterval(scramble.id); el.textContent = TITLE; },
    });

    return () => { clearInterval(scramble.id); tl.kill(); };
  }, []);

  // Ticker marquee
  useEffect(() => {
    const el = tickerRef.current;
    if (!el) return;
    const tween = gsap.fromTo(el, { x: 0 }, { x: '-50%', duration: 30, ease: 'none', repeat: -1 });
    return () => { tween.kill(); };
  }, []);

  const tickerMsg = error
    ? `\u25cf SYSTEM ERROR: ${error}`
    : degraded
      ? '\u25cf DEGRADED MODE \u2014 SOME AGENTS OFFLINE'
      : '\u25cf ALL SYSTEMS NOMINAL \u2014 FLEET OPERATIONAL';

  const bar = {
    position: 'absolute' as const, left: 0, right: 0, zIndex: 10,
    background: 'rgba(5,5,20,0.85)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(0,229,255,0.15)', fontFamily: font,
    fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: text,
  };

  return (
    <>
      {/* Pulse keyframe */}
      <style>{`@keyframes hud-pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>

      {/* TOP BAR */}
      <div style={{ ...bar, top: 0, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0f0', animation: 'hud-pulse 1.5s ease infinite', flexShrink: 0 }} />
          <span style={{ color: '#0f0', fontSize: 9 }}>LIVE</span>
          <span style={{ color: dim, margin: '0 4px' }}>|</span>
          <span>AGENT FLEET: <b style={{ color: cyan }}>{activeAgents}/{totalAgents}</b> ACTIVE</span>
        </div>

        <span ref={titleRef} style={{ color: cyan, fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', flexShrink: 0 }}>{TITLE}</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ color: dim, fontSize: 9, whiteSpace: 'nowrap' }}>{clock}</span>
          <button
            onClick={onCleanup}
            style={{
              background: 'rgba(0,229,255,0.08)', border: `1px solid rgba(0,229,255,0.25)`,
              color: cyan, fontFamily: font, fontSize: 9, padding: '3px 8px', borderRadius: 4,
              cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase',
            }}
          >
            {'\ud83e\uddf9'} Cleanup
          </button>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div style={{ ...bar, bottom: 0, padding: '6px 16px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <div ref={tickerRef} style={{ display: 'inline-block', color: error ? '#ff5252' : degraded ? '#ffc107' : '#0f0', fontSize: 9 }}>
            <span style={{ paddingRight: 80 }}>{tickerMsg}</span>
            <span style={{ paddingRight: 80 }}>{tickerMsg}</span>
          </div>
        </div>
        {syncing && (
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: cyan, animation: 'hud-pulse 1s ease infinite', marginLeft: 12, flexShrink: 0 }} />
        )}
      </div>
    </>
  );
}
