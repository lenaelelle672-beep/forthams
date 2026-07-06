import type { CSSProperties } from 'react';

export interface AssetLocation {
  name: string;
  coord: [number, number];
  assetCount: number;
  isHQ?: boolean;
}

interface Props {
  locations?: AssetLocation[];
  height?: number | string;
}

type StyleVars = CSSProperties & Record<`--${string}`, string | number>;

const DEFAULT_LOCATIONS: AssetLocation[] = [
  { name: '成都枢纽', coord: [104.07, 30.67], assetCount: 3200, isHQ: true },
  { name: '北京', coord: [116.41, 39.91], assetCount: 1850 },
  { name: '上海', coord: [121.47, 31.23], assetCount: 1420 },
  { name: '广州', coord: [113.26, 23.13], assetCount: 980 },
  { name: '深圳', coord: [114.06, 22.54], assetCount: 760 },
  { name: '武汉', coord: [114.3, 30.6], assetCount: 640 },
  { name: '西安', coord: [108.94, 34.34], assetCount: 510 },
];

const CSS = `
.asset-globe-stage {
  position: relative;
  display: grid;
  width: 100%;
  min-height: 0;
  place-items: center;
}

.asset-globe-system {
  position: relative;
  width: min(97%, 64vh, 580px);
  aspect-ratio: 1;
}

.asset-globe-orbits {
  position: absolute;
  inset: -10%;
  pointer-events: none;
  filter: drop-shadow(0 0 12px rgba(70, 190, 255, 0.18));
}

.asset-globe-tick-ring {
  position: absolute;
  inset: -5%;
  border-radius: 50%;
  border: 1px solid rgba(120, 205, 255, 0.32);
  background: repeating-conic-gradient(from 0deg, rgba(130, 210, 255, 0.64) 0deg 0.8deg, transparent 0.8deg 4.2deg);
  opacity: 0.48;
  -webkit-mask: radial-gradient(circle, transparent 0 49.3%, #000 49.7% 50.3%, transparent 50.7%);
  mask: radial-gradient(circle, transparent 0 49.3%, #000 49.7% 50.3%, transparent 50.7%);
}

.asset-globe {
  position: absolute;
  inset: 9.5%;
  overflow: hidden;
  border-radius: 50%;
  background:
    radial-gradient(circle at 34% 24%, rgba(238, 255, 255, 0.96) 0 3%, rgba(110, 225, 255, 0.88) 8%, transparent 20%),
    radial-gradient(circle at 42% 40%, rgba(68, 204, 255, 0.88), rgba(8, 111, 221, 0.96) 38%, rgba(1, 45, 140, 0.98) 62%, rgba(0, 12, 55, 0.98) 100%);
  box-shadow:
    inset 24px 14px 52px rgba(180, 246, 255, 0.28),
    inset -42px -28px 76px rgba(0, 6, 38, 0.8),
    0 0 42px rgba(45, 173, 255, 0.5),
    0 0 118px rgba(15, 102, 255, 0.38);
}

.asset-globe::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    repeating-linear-gradient(0deg, rgba(210, 252, 255, 0.12) 0 1px, transparent 1px 22px),
    repeating-linear-gradient(90deg, rgba(210, 252, 255, 0.10) 0 1px, transparent 1px 25px),
    radial-gradient(circle at 50% 50%, transparent 0 56%, rgba(0, 9, 52, 0.32) 74%, rgba(0, 4, 27, 0.78) 100%);
  mix-blend-mode: screen;
  opacity: 0.52;
}

.asset-globe::after {
  content: '';
  position: absolute;
  inset: -3%;
  border-radius: 50%;
  background: radial-gradient(circle at 28% 18%, rgba(255,255,255,.32), transparent 16%), linear-gradient(115deg, rgba(255,255,255,.22), transparent 34%, rgba(0,0,0,.22) 82%);
  pointer-events: none;
}

.asset-globe-map {
  position: absolute;
  inset: 4% 2% 0 0;
  width: 102%;
  height: 98%;
  opacity: 0.76;
  filter: drop-shadow(0 0 8px rgba(166, 247, 255, 0.5));
}

.asset-globe-map path {
  fill: rgba(132, 219, 218, 0.46);
  stroke: rgba(212, 255, 255, 0.72);
  stroke-width: 1.1;
}

.asset-globe-node {
  position: absolute;
  z-index: 4;
  left: var(--x);
  top: var(--y);
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 5px;
  color: rgba(222, 249, 255, 0.82);
  font-size: 10px;
  white-space: nowrap;
  text-shadow: 0 0 8px rgba(0, 14, 36, 0.9);
}

.asset-globe-node i {
  width: var(--s);
  height: var(--s);
  border-radius: 50%;
  background: var(--tone);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--tone) 22%, transparent), 0 0 13px var(--tone);
}

.asset-globe-node.is-hq {
  color: #fff;
  font-weight: 700;
}

.asset-globe-flight {
  position: absolute;
  inset: -4%;
  z-index: 3;
  pointer-events: none;
}

.asset-globe-flight path {
  fill: none;
  stroke: rgba(255, 124, 118, 0.66);
  stroke-width: 1;
  stroke-dasharray: 4 4;
  filter: drop-shadow(0 0 4px rgba(255, 122, 118, 0.62));
}

.asset-globe-flight circle {
  fill: #fff;
  filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.86));
}

.asset-globe-legend {
  position: absolute;
  left: 50%;
  bottom: 1.5%;
  z-index: 5;
  display: flex;
  gap: 20px;
  transform: translateX(-50%);
  color: rgba(195, 226, 255, 0.62);
  font-size: 11px;
}

.asset-globe-legend span { display: inline-flex; align-items: center; gap: 5px; }
.asset-globe-legend i { width: 7px; height: 7px; border-radius: 50%; background: var(--tone); }
`;

function toPoint([lng, lat]: [number, number]) {
  const x = 38 + ((lng - 95) / 35) * 30;
  const y = 50 - ((lat - 18) / 25) * 24;
  return [Math.max(30, Math.min(72, x)), Math.max(23, Math.min(62, y))];
}

export default function AssetMapChart({ locations = DEFAULT_LOCATIONS, height = '100%' }: Props) {
  return (
    <div className="asset-globe-stage" style={{ height }}>
      <style>{CSS}</style>
      <div className="asset-globe-system">
        <div className="asset-globe-tick-ring" />
        <svg className="asset-globe-orbits" viewBox="0 0 600 600">
          <ellipse cx="300" cy="300" rx="260" ry="78" fill="none" stroke="rgba(156,220,255,.42)" strokeWidth="1" strokeDasharray="5 5" transform="rotate(-24 300 300)" />
          <ellipse cx="300" cy="300" rx="260" ry="78" fill="none" stroke="rgba(156,220,255,.30)" strokeWidth="1" strokeDasharray="3 8" transform="rotate(28 300 300)" />
          <ellipse cx="300" cy="300" rx="224" ry="224" fill="none" stroke="rgba(94,184,255,.18)" strokeWidth="1" />
          <path d="M88 214 C188 302 298 350 510 430" fill="none" stroke="rgba(255,116,116,.45)" strokeWidth="1" strokeDasharray="4 6" />
          <path d="M90 404 C190 334 336 300 526 206" fill="none" stroke="rgba(49,214,255,.35)" strokeWidth="1" strokeDasharray="4 6" />
        </svg>
        <div className="asset-globe">
          <svg className="asset-globe-map" viewBox="0 0 480 420" preserveAspectRatio="xMidYMid meet">
            <path d="M111 171C140 120 195 100 241 123C277 141 288 165 330 157C364 150 386 171 382 206C376 254 329 261 308 296C285 333 244 338 218 302C199 275 176 267 139 268C101 269 86 222 111 171Z" />
            <path d="M242 212C269 197 307 199 324 224C339 246 324 274 296 279C269 284 241 264 236 239C233 228 235 219 242 212Z" />
            <path d="M309 274C331 270 353 280 363 299C345 313 324 314 304 302C296 292 298 282 309 274Z" />
            <path d="M174 280C188 297 184 322 164 334C145 320 140 296 151 279C158 275 166 276 174 280Z" />
            <path d="M335 118C361 108 395 115 414 139C395 157 365 158 339 144C329 136 328 126 335 118Z" />
          </svg>
          <svg className="asset-globe-flight" viewBox="0 0 600 600">
            <path d="M315 293 C398 250 456 219 545 196" />
            <path d="M315 293 C428 327 486 372 552 450" />
            <path d="M315 293 C224 252 154 238 58 238" />
            <circle cx="545" cy="196" r="3" />
            <circle cx="552" cy="450" r="3" />
            <circle cx="58" cy="238" r="3" />
          </svg>
          {locations.map((location) => {
            const [x, y] = toPoint(location.coord);
            const tone = location.isHQ ? '#ff4f6d' : location.assetCount > 1000 ? '#ffd45c' : '#31d6ff';
            return (
              <span
                key={location.name}
                className={`asset-globe-node ${location.isHQ ? 'is-hq' : ''}`}
                style={{ '--x': `${x}%`, '--y': `${y}%`, '--s': location.isHQ ? '9px' : '6px', '--tone': tone } as StyleVars}
              >
                <i />{location.name}
              </span>
            );
          })}
        </div>
        <div className="asset-globe-legend">
          <span style={{ '--tone': '#31d6ff' } as StyleVars}><i />国内</span>
          <span style={{ '--tone': '#54ffc9' } as StyleVars}><i />国际</span>
          <span style={{ '--tone': '#ffd45c' } as StyleVars}><i />运力</span>
          <span style={{ '--tone': '#ff647a' } as StyleVars}><i />收入</span>
        </div>
      </div>
    </div>
  );
}
