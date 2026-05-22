import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Center, Html, MeshReflectorMaterial, OrbitControls, Trail, useTexture } from '@react-three/drei';
import { useQuery } from '@tanstack/react-query';
import { geoMercator } from 'd3-geo';
import { Activity, AlertTriangle, Boxes, Database, Gauge, Radio, RotateCcw, ShieldCheck, Warehouse } from 'lucide-react';
import {
  AdditiveBlending,
  Box2,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Material,
  Mesh,
  Path,
  QuadraticBezierCurve3,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
  type Group,
  type Object3D,
} from 'three';
import http from '@/utils/http';
import sichuanData from '@/assets/sc-demo2.json';
import sichuanOutlineData from '@/assets/sc-outline-demo2.json';
import scTerrainMap from '@/assets/sc-map.png';
import scReliefMap from '@/assets/sc-displacement-map.png';
import scNormalMap from '@/assets/sc-normal-map1.png';
import cityRingTexture from '@/assets/guangquan01.png';
import flyLineTexture from '@/assets/fly-line.png';
import bottomHaloTexture from '@/assets/quan1.png';

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
const MAP_DEPTH = 1;

const SIDE_SCAN_VERTEX_SHADER = `
varying vec3 vPosition;
void main() {
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SIDE_SCAN_FRAGMENT_SHADER = `
varying vec3 vPosition;
uniform float time;
uniform float depth;
uniform vec3 baseTopColor;
uniform vec3 baseBottomColor;
uniform vec3 scanColor;
uniform float opacity;

void main() {
  float bandHeight = 0.45;
  float normalizedHeight = clamp(vPosition.z / depth, 0.0, 1.0);
  float progress = fract(time) * (1.0 + bandHeight) - bandHeight;
  float distance = (progress + bandHeight) - normalizedHeight;
  float belowHead = step(0.0, distance);
  float withinBand = clamp(1.0 - distance / bandHeight, 0.0, 1.0) * belowHead;
  float feather = smoothstep(0.0, 1.0, withinBand);
  float bandCore = pow(feather, 1.5);
  float bandEdge = smoothstep(0.0, 0.6, withinBand) * (1.0 - smoothstep(0.6, 1.0, withinBand));
  float scanStrength = bandCore * 0.85 + bandEdge * 0.4;

  if (normalizedHeight < 0.001 || normalizedHeight > 0.999) {
    scanStrength = 0.0;
  }

  vec3 baseColor = mix(baseBottomColor, baseTopColor, normalizedHeight);
  vec3 scanned = mix(baseColor, scanColor, clamp(scanStrength, 0.0, 1.0));
  gl_FragColor = vec4(scanned, opacity);
}
`;

const BOUNDARY_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vNormal;
varying float vHeight;

void main() {
  vUv = uv;
  vNormal = normal;
  vHeight = position.z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const BOUNDARY_FRAGMENT_SHADER = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uDepth;
varying vec2 vUv;
varying vec3 vNormal;
varying float vHeight;

void main() {
  if (vNormal.z == 1.0 || vNormal.z == -1.0 || vUv.y == 0.0) {
    discard;
  } else {
    float h = mix(1.0, 0.0, vHeight / uDepth);
    gl_FragColor = vec4(uColor, h * uOpacity);
  }
}
`;

const BEAM_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const BEAM_FRAGMENT_SHADER = `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;

void main() {
  float strength = 1.0 - abs(vUv.x - 0.5) * 2.0;
  strength = pow(strength, 2.0);
  float verticalFade = pow(sin(vUv.y * 3.14159), 0.5);
  float brightness = strength * verticalFade;
  vec3 finalColor = uColor * brightness * 2.0;
  gl_FragColor = vec4(finalColor, brightness * uOpacity);
}
`;

const fallbackStats = {
  totalAssets: 57,
  inUseAssets: 21,
  idleAssets: 25,
  scrapAssets: 9,
  utilizationRate: 36.8,
  totalValue: 60000,
  netValue: 49000,
  pendingApprovals: 3,
  pendingWorkOrders: 24,
  inventoryProgress: 70,
  criticalAlerts: 7,
};

type Stats = typeof fallbackStats;
type StyleVars = CSSProperties & Record<`--${string}`, string | number>;

type GeoFeature = {
  properties: {
    name: string;
    center?: [number, number];
    centroid?: [number, number];
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
};

type GeoCollection = {
  features: GeoFeature[];
};

type MapRegion = {
  name: string;
  center: Vector3;
  shapes: Shape[];
  shapeGeometry: ShapeGeometry;
  outlineRings: Vector3[][];
};

type MapModel = {
  regions: MapRegion[];
  boundary: Shape[];
  boundaryPoints: Vector3[];
  boundaryRings: Vector3[][];
  bbox: Box2;
  project: (coord: [number, number]) => Vector2;
};

type CityMetric = {
  name: string;
  assetCount: number;
  onlineRate: number;
  warningCount: number;
  netValue: number;
};

const sichuanGeoData = sichuanData as unknown as GeoCollection;
const sichuanOutlineGeoData = sichuanOutlineData as unknown as GeoCollection;

const cityWeights = [0.18, 0.08, 0.05, 0.07, 0.09, 0.1, 0.045, 0.05, 0.04, 0.035, 0.045, 0.04, 0.055, 0.035, 0.03, 0.025, 0.03, 0.025, 0.02, 0.02];

const categoryBands = [
  { label: 'IT 设备', value: 42, tone: '#bdcfff' },
  { label: '办公家具', value: 24, tone: '#789eff' },
  { label: '生产设备', value: 21, tone: '#3061db' },
  { label: '低值耗材', value: 13, tone: '#91cfd4' },
];

const forecastLines = [24, 31, 28, 38, 45, 41, 55, 62, 58, 72, 68, 84];
const valueBars = [32, 48, 71, 64, 88];
const deviceStats = [
  { label: '办公终端', value: 112, unit: '台', sub: '在线', subValue: 98, icon: <Database size={30} /> },
  { label: '智能仓储', value: 36, unit: '组', sub: '库位', subValue: 420, icon: <Warehouse size={30} /> },
  { label: 'RFID 标签', value: 131, unit: '枚', sub: '读写', subValue: 96, icon: <Radio size={30} /> },
  { label: '审计链路', value: 39, unit: '条', sub: '留痕', subValue: 100, icon: <ShieldCheck size={30} /> },
];

const warningRows = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  event: ['维保到期', '借用超期', '标签离线', '审批积压', '盘点差异'][index % 5],
  count: [8, 6, 4, 3, 2][index % 5] + index,
  alarm: [2, 5, 1, 4, 3][index % 5],
  status: index % 2 === 0 ? '处理中' : '已处理',
}));

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');

.ams3d-page,
.ams3d-page * { box-sizing: border-box; }

.ams3d-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
  color: #e8efff;
  font-family: Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  isolation: isolate;
}

.ams3d-map-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: #000;
}

.ams3d-map-layer canvas {
  display: block;
  background: #000 !important;
}

.ams3d-stage {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 5;
  width: ${DESIGN_WIDTH}px;
  height: ${DESIGN_HEIGHT}px;
  pointer-events: none;
  transform: translate(-50%, -50%) scale(var(--stage-scale));
  transform-origin: center center;
}

.ams3d-header {
  position: relative;
  height: 85px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  animation: ams3d-slide-down 0.7s ease 2s both;
}

.ams3d-header svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.ams3d-title {
  position: relative;
  z-index: 2;
  display: grid;
  justify-items: center;
  gap: 2px;
  margin-top: 2px;
}

.ams3d-title-main {
  display: flex;
  align-items: center;
  gap: 14px;
  color: #fff;
  font-size: 34px;
  font-weight: 800;
  letter-spacing: 8px;
  line-height: 1;
  text-shadow: 0 0 18px rgba(120, 158, 255, 0.76), 0 8px 22px rgba(48, 97, 219, 0.5);
}

.ams3d-title-main svg { color: #bdcfff; filter: drop-shadow(0 0 10px #789eff); }

.ams3d-title-sub {
  color: rgba(189, 207, 255, 0.72);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  letter-spacing: 10px;
}

.ams3d-meta,
.ams3d-status {
  position: absolute;
  top: 24px;
  z-index: 2;
  display: flex;
  gap: 18px;
  color: rgba(232, 239, 255, 0.7);
  font-size: 13px;
}

.ams3d-meta { left: 32px; }
.ams3d-status { right: 32px; }
.ams3d-meta strong,
.ams3d-status strong { color: #bdcfff; font-family: 'JetBrains Mono', monospace; }

.ams3d-grid {
  position: absolute;
  inset: 85px 0 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: repeat(6, minmax(0, 1fr));
  gap: 20px;
  padding: 20px;
  background: transparent !important;
}

.ams3d-card {
  position: relative;
  overflow: hidden;
  min-height: 0;
  pointer-events: auto;
  background: linear-gradient(180deg, rgba(3, 11, 28, 0.74), rgba(2, 6, 18, 0.52));
  box-shadow: inset 0 0 30px rgba(48, 97, 219, 0.08), 0 18px 42px rgba(0, 0, 0, 0.24);
  opacity: 0;
}

.ams3d-card.left { animation: ams3d-slide-right 0.8s ease both; }
.ams3d-card.right { animation: ams3d-slide-left 0.8s ease both; }
.ams3d-card:nth-of-type(1), .ams3d-card:nth-of-type(4) { animation-delay: 2.35s; }
.ams3d-card:nth-of-type(2), .ams3d-card:nth-of-type(5) { animation-delay: 2.45s; }
.ams3d-card:nth-of-type(3), .ams3d-card:nth-of-type(6) { animation-delay: 2.55s; }

.ams3d-card-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.ams3d-card-inner {
  position: relative;
  z-index: 1;
  display: flex;
  height: 100%;
  flex-direction: column;
}

.ams3d-card-title {
  position: relative;
  display: flex;
  min-height: 50px;
  align-items: center;
  justify-content: space-between;
  margin: 0 20px;
  border-bottom: 1px solid rgba(186, 206, 255, 0.33);
  color: #e8efff;
  font-size: 16px;
  font-weight: 700;
  line-height: 50px;
}

.ams3d-card-title::before {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 50px;
  height: 4px;
  background: #bdcfff;
  box-shadow: 0 0 12px rgba(189, 207, 255, 0.72);
}

.ams3d-card-title::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  width: 4px;
  height: 4px;
  border-radius: 2px;
  background: #bdcfff;
}

.ams3d-card-title-main { display: inline-flex; align-items: center; gap: 8px; }
.ams3d-card-title svg { color: #789eff; filter: drop-shadow(0 0 8px rgba(120, 158, 255, 0.72)); }
.ams3d-card-title small { color: rgba(189, 207, 255, 0.48); font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.12em; }

.ams3d-card-content {
  flex: 1;
  min-height: 0;
  padding: 18px 20px 20px;
}

.ams3d-kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.ams3d-kpi { padding: 12px; border: 1px solid rgba(120, 158, 255, 0.14); background: rgba(4, 12, 30, 0.6); }
.ams3d-kpi span { display: block; color: rgba(232, 239, 255, 0.62); font-size: 13px; }
.ams3d-kpi strong { display: block; margin-top: 8px; color: #3061db; font-family: 'JetBrains Mono', monospace; font-size: 28px; line-height: 1; text-shadow: 0 0 12px rgba(48, 97, 219, 0.6); }
.ams3d-kpi small { margin-left: 4px; color: rgba(232, 239, 255, 0.54); font-size: 12px; }

.ams3d-bars { display: grid; gap: 13px; }
.ams3d-bar-row { display: grid; grid-template-columns: 76px 1fr 44px; align-items: center; gap: 10px; color: rgba(232, 239, 255, 0.72); font-size: 13px; }
.ams3d-bar-track { height: 8px; overflow: hidden; background: rgba(120, 158, 255, 0.1); transform: skewX(-24deg); }
.ams3d-bar-fill { width: var(--pct); height: 100%; background: linear-gradient(90deg, rgba(0, 0, 0, 0.12), var(--tone)); box-shadow: 0 0 14px color-mix(in srgb, var(--tone) 60%, transparent); animation: ams3d-grow-x 1.2s ease 2.9s both; transform-origin: left center; }
.ams3d-bar-num { color: #bdcfff; font-family: 'JetBrains Mono', monospace; text-align: right; }

.ams3d-line-chart { position: relative; width: 100%; height: 100%; min-height: 126px; }
.ams3d-line-chart svg { width: 100%; height: 100%; overflow: visible; }
.ams3d-line-chart polyline { stroke-dasharray: 450; stroke-dashoffset: 450; animation: ams3d-draw-line 2s ease 3s both; }
.ams3d-line-grid { stroke: rgba(255, 255, 255, 0.08); stroke-width: 1; }

.ams3d-column-bars { display: grid; height: 100%; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; align-items: end; }
.ams3d-column { display: grid; align-content: end; justify-items: center; gap: 8px; color: rgba(232, 239, 255, 0.62); font-size: 12px; }
.ams3d-column-value { color: #bdcfff; font-family: 'JetBrains Mono', monospace; }
.ams3d-column-bar { width: 30px; height: var(--height); min-height: 28px; background: linear-gradient(180deg, #bdcfff, #3061db 62%, rgba(0, 0, 0, 0.1)); box-shadow: 0 0 14px rgba(48, 97, 219, 0.62); animation: ams3d-grow-y 1.1s ease 3s both; transform-origin: bottom center; }

.ams3d-device-grid { display: grid; height: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.ams3d-device { display: flex; align-items: center; gap: 10px; color: rgba(232, 239, 255, 0.78); }
.ams3d-device-icon { display: grid; width: 54px; height: 54px; place-items: center; border: 1px solid #3061db; border-radius: 999px; color: #789eff; box-shadow: 0 0 14px rgba(48, 97, 219, 0.58); }
.ams3d-device strong { color: #3061db; font-family: 'JetBrains Mono', monospace; font-size: 24px; text-shadow: 0 0 10px currentColor; }
.ams3d-device small { color: #bdcfff; font-family: 'JetBrains Mono', monospace; }

.ams3d-city-list { display: grid; gap: 10px; }
.ams3d-city-row { display: grid; grid-template-columns: 64px 1fr 44px; gap: 10px; align-items: center; color: rgba(232, 239, 255, 0.7); font-size: 13px; }
.ams3d-city-row strong { color: #e8efff; }
.ams3d-city-track { height: 8px; background: rgba(120, 158, 255, 0.1); }
.ams3d-city-fill { width: var(--pct); height: 100%; background: linear-gradient(90deg, #3061db, #bdcfff); box-shadow: 0 0 12px rgba(120, 158, 255, 0.54); }
.ams3d-focus { margin-top: 14px; padding: 10px; border: 1px solid rgba(120, 158, 255, 0.18); background: rgba(4, 12, 30, 0.54); color: rgba(232, 239, 255, 0.72); font-size: 13px; }
.ams3d-focus strong { display: block; margin-bottom: 5px; color: #bdcfff; font-size: 17px; }

.ams3d-warning-table { height: 100%; overflow: hidden; }
.ams3d-warning-head,
.ams3d-warning-row { display: grid; grid-template-columns: 38px 1fr 58px 58px 62px; gap: 8px; align-items: center; min-height: 34px; color: rgba(232, 239, 255, 0.72); font-size: 13px; }
.ams3d-warning-head { color: rgba(232, 239, 255, 0.54); }
.ams3d-warning-body { animation: ams3d-scroll-y 10s linear 3s infinite; }
.ams3d-warning-row { color: #3061db; font-family: 'JetBrains Mono', monospace; }
.ams3d-warning-row span:nth-child(2) { color: #bdcfff; font-family: Inter, sans-serif; }
.ams3d-warning-row b { color: #ffa800; font-weight: 500; }

.ams3d-bottom-halo {
  position: absolute;
  left: 50%;
  bottom: 26px;
  z-index: 1;
  width: 520px;
  height: 72px;
  border-top: 1px solid rgba(120, 158, 255, 0.52);
  border-radius: 50%;
  transform: translateX(-50%);
  box-shadow: 0 -12px 42px rgba(48, 97, 219, 0.26);
}

.ams3d-map-label {
  width: max-content;
  min-width: max-content;
  color: #fff;
  font-size: 12px;
  text-shadow: 0 0 8px rgba(120, 158, 255, 0.8), 0 2px 8px rgba(0, 0, 0, 0.9);
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
}

@keyframes ams3d-slide-down { from { opacity: 0; transform: translateY(-100%); } to { opacity: 1; transform: translateY(0); } }
@keyframes ams3d-slide-right { from { opacity: 0; transform: translateX(-100%); } to { opacity: 1; transform: translateX(0); } }
@keyframes ams3d-slide-left { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
@keyframes ams3d-grow-x { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes ams3d-grow-y { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes ams3d-draw-line { to { stroke-dashoffset: 0; } }
@keyframes ams3d-scroll-y { 0%, 16% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
`;

function formatNumber(value: number | string | undefined | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return new Intl.NumberFormat('zh-CN').format(n);
}

function formatWan(value: number) {
  return `${(value / 10000).toFixed(1)}万`;
}

function HeaderRail() {
  return (
    <svg fill="none" viewBox="0 0 1920 85" preserveAspectRatio="none" aria-hidden="true">
      <g clipPath="url(#ams-demo2-header-clip)">
        <path fill="#3061DB" fillOpacity="0.5" d="M0 0h1920v85H0z" opacity="0.08" />
        <path fill="#3061DB" fillOpacity="0.3" d="M22 83h344.5v2H22zM379 83h345v2H379zM736.5 83h346v2h-346z" />
        <path fill="#3061DB" d="M1 2h76.5v2H1zM81.5 2H89v2h-7.5z" />
        <path fill="#3061DB" fillOpacity="0.3" d="M93 2h527v2H93z" />
        <path fill="#3061DB" d="M625 2h11.5v2H625z" />
        <path fill="#789EFF" fillOpacity="0.28" d="M1223 19.5h134V67h-134z" />
        <path fill="#3061DB" fillRule="evenodd" d="M1218.25 55.5v16.25H1236v-2.5h-15.25V55.5h-2.5Zm140 0v13.75h-15.5v2.5h17.75V55.5h-2.25ZM1219.5 15.5h-1.25v16.25h2.5V18H1236v-2.5h-16.5Zm123.25 2.5v-2.5h17.75v16.25h-2.5V18h-15.25Z" />
        <g fill="#3061DB" opacity="0.8">
          <path fillOpacity="0.9" d="M691.851 19.469h3.44L680.939 29h-3.44l14.352-9.531Z" />
          <path fillOpacity="0.7" d="M698.206 19.469h3.44L687.294 29h-3.44l14.352-9.531Z" />
          <path fillOpacity="0.5" d="M704.56 19.469H708L693.648 29h-3.44l14.352-9.531Z" />
        </g>
        <path fill="url(#ams-demo2-header-line)" d="M708 27h400v2H708z" />
      </g>
      <defs>
        <linearGradient id="ams-demo2-header-line" x1="708" x2="1108" y1="29" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#789EFF" stopOpacity="0.45" />
          <stop offset="1" stopColor="#789EFF" stopOpacity="0" />
        </linearGradient>
        <clipPath id="ams-demo2-header-clip"><path fill="#fff" d="M0 85h1920V0H0v85Z" /></clipPath>
      </defs>
    </svg>
  );
}

function Panel({ title, tag, icon, side, style, children }: { title: string; tag: string; icon: ReactNode; side: 'left' | 'right'; style: CSSProperties; children: ReactNode }) {
  return (
    <section className={`ams3d-card ${side}`} style={style}>
      <svg className="ams3d-card-frame" fill="none" viewBox="0 0 260 180" preserveAspectRatio="none" aria-hidden="true">
        <path fill="#3061DB" fillRule="evenodd" d="M206 10 190 0H9L0 9v171h45l4.5-4h161l4.5 4h45V10h-54Zm53 1h-53.287l-16-10H9.414L1 9.414V179h43.62l4.5-4h161.76l4.5 4H259V11Z" />
        <path fill="#789eff" d="m51 178-2 2h162l-2-2H51ZM0 0v7l7-7H0Z" />
        <path stroke="#789eff" strokeWidth={2} d="M1 169v10h10M259 21V11h-10" />
      </svg>
      <div className="ams3d-card-inner">
        <div className="ams3d-card-title">
          <span className="ams3d-card-title-main">{icon}{title}</span>
          <small>{tag}</small>
        </div>
        <div className="ams3d-card-content">{children}</div>
      </div>
    </section>
  );
}

function NumberTicker({ value, options, className }: { value: number; options?: Intl.NumberFormatOptions; className?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const duration = 1200;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className={className}>{new Intl.NumberFormat('zh-CN', options).format(display)}</span>;
}

function LinePreview() {
  const points = forecastLines.map((value, index) => `${index * 31 + 12},${112 - value}`).join(' ');
  return (
    <div className="ams3d-line-chart">
      <svg viewBox="0 0 370 130" preserveAspectRatio="none">
        {[22, 50, 78, 106].map((y) => <line key={y} className="ams3d-line-grid" x1="0" x2="370" y1={y} y2={y} />)}
        <polyline points={points} fill="none" stroke="#3061DB" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={points} fill="none" stroke="#BDCFFF" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />
      </svg>
    </div>
  );
}

function ValueColumns() {
  return (
    <div className="ams3d-column-bars">
      {valueBars.map((value, index) => (
        <div key={value} className="ams3d-column">
          <span className="ams3d-column-value">{value}</span>
          <div className="ams3d-column-bar" style={{ '--height': `${Math.max(34, value)}%` } as StyleVars} />
          <span>{['50', '100', '500', '1000', '1000+'][index]}</span>
        </div>
      ))}
    </div>
  );
}

function DeviceGrid() {
  return (
    <div className="ams3d-device-grid">
      {deviceStats.map((item) => (
        <div key={item.label} className="ams3d-device">
          <div className="ams3d-device-icon">{item.icon}</div>
          <div>
            <div>{item.label} <strong>{item.value}</strong> <span>{item.unit}</span></div>
            <div>{item.sub} <small>{item.subValue}</small></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WarningTable() {
  const rows = [...warningRows, ...warningRows];
  return (
    <div className="ams3d-warning-table">
      <div className="ams3d-warning-head"><span>序号</span><span>异常事件</span><span>次数</span><span>报警</span><span>状态</span></div>
      <div className="ams3d-warning-body">
        {rows.map((row, index) => (
          <div key={`${row.id}-${index}`} className="ams3d-warning-row">
            <span>{row.id}</span><span>{row.event}</span><span>{row.count}</span><span>{row.alarm}</span><b>{row.status}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function collectCoordinates(collection: GeoCollection) {
  const coords: [number, number][] = [];
  collection.features.forEach((feature) => {
    const polygons = feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates as number[][][]]
      : feature.geometry.coordinates as number[][][][];
    polygons.forEach((polygon) => polygon.forEach((ring) => ring.forEach((coord) => coords.push(coord as [number, number]))));
  });
  return coords;
}

function makeMapModel(data: GeoCollection, outlineData: GeoCollection): MapModel {
  const coords = collectCoordinates(data);
  const fallbackCenter = coords.reduce((sum, [lng, lat]) => sum.add(new Vector2(lng, lat)), new Vector2()).divideScalar(Math.max(coords.length, 1));
  const projectionCenter = data.features[0]?.properties.centroid ?? data.features[0]?.properties.center ?? [fallbackCenter.x, fallbackCenter.y];
  const projection = geoMercator().center(projectionCenter).translate([0, 0]);
  const project = ([lng, lat]: [number, number]) => {
    const projected = projection([lng, lat]);
    return projected ? new Vector2(projected[0], -projected[1]) : new Vector2();
  };
  const bbox = new Box2();

  const toShape = (polygon: number[][][]) => {
    if (!polygon[0]?.length) return null;
    const outer = polygon[0].map((coord) => {
      const point = project(coord as [number, number]);
      bbox.expandByPoint(point);
      return point;
    });
    const shape = new Shape(outer);
    polygon.slice(1).forEach((ring) => shape.holes.push(new Path(ring.map((coord) => project(coord as [number, number])))));
    return shape;
  };

  const regions = data.features.map((feature) => {
    const polygons = feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates as number[][][]]
      : feature.geometry.coordinates as number[][][][];
    const shapes = polygons.map(toShape).filter(Boolean) as Shape[];
    const outlineRings = polygons.map((polygon) => (polygon[0] ?? []).map((coord) => {
      const point = project(coord as [number, number]);
      return new Vector3(point.x, point.y, MAP_DEPTH + 0.14);
    })).filter((ring) => ring.length > 0);
    const centerCoord = feature.properties.centroid ?? feature.properties.center ?? projectionCenter;
    const projectedCenter = project(centerCoord);
    return {
      name: feature.properties.name,
      center: new Vector3(projectedCenter.x, projectedCenter.y, 0),
      shapes,
      shapeGeometry: new ShapeGeometry(shapes),
      outlineRings,
    };
  });

  const boundary: Shape[] = [];
  const boundaryPoints: Vector3[] = [];
  const boundaryRings: Vector3[][] = [];
  outlineData.features.forEach((feature) => {
    const polygons = feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates as number[][][]]
      : feature.geometry.coordinates as number[][][][];
    polygons.forEach((polygon) => {
      const shape = toShape(polygon);
      if (shape) boundary.push(shape);
      const outerRing = polygon[0]?.map((coord) => {
        const point = project(coord as [number, number]);
        const vector = new Vector3(point.x, point.y, MAP_DEPTH + 0.45);
        boundaryPoints.push(vector);
        return vector;
      }) ?? [];
      if (outerRing.length > 0) {
        boundaryRings.push(outerRing.map((point) => point.clone().setZ(MAP_DEPTH + 0.12)));
      }
    });
  });

  return { regions, boundary, boundaryPoints, boundaryRings, bbox, project };
}

function setMaterialOpacity(material: Material | Material[] | undefined, opacity: number) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach((item) => setMaterialOpacity(item, opacity));
    return;
  }
  const maxOpacity = typeof material.userData.maxOpacity === 'number' ? material.userData.maxOpacity : 1;
  const nextOpacity = opacity * maxOpacity;
  material.opacity = nextOpacity;
  material.transparent = true;
  if (material instanceof ShaderMaterial && material.uniforms.opacity) {
    material.uniforms.opacity.value = nextOpacity;
  }
}

function setTreeOpacity(object: Object3D, opacity: number) {
  const maybeMesh = object as Mesh;
  setMaterialOpacity(maybeMesh.material, opacity);
}

function ShapeBox({ shapes, bbox, children }: { shapes: Shape[]; bbox: Box2; children: ReactNode }) {
  const meshRef = useRef<Mesh>(null);

  useLayoutEffect(() => {
    const geometry = meshRef.current?.geometry;
    const position = geometry?.attributes.position;
    if (!geometry || !position) return;
    const width = bbox.max.x - bbox.min.x || 1;
    const height = bbox.max.y - bbox.min.y || 1;
    const uv: number[] = [];
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      uv.push((x - bbox.min.x) / width, (y - bbox.min.y) / height);
    }
    geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  }, [bbox, shapes]);

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <extrudeGeometry args={[shapes, { depth: MAP_DEPTH, bevelEnabled: false }]} />
      {children}
    </mesh>
  );
}

function MapSideScanMaterial({ depth, active }: { depth: number; active: boolean }) {
  const materialRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    depth: { value: depth },
    baseTopColor: { value: new Color('#8fc2ff') },
    baseBottomColor: { value: new Color('#10182c') },
    scanColor: { value: new Color('#8fc2ff') },
    opacity: { value: 0 },
  }), [depth]);

  useEffect(() => {
    uniforms.baseTopColor.value.set(active ? '#bdcfff' : '#8fc2ff');
    uniforms.baseBottomColor.value.set(active ? '#173772' : '#10182c');
    uniforms.scanColor.value.set(active ? '#ffffff' : '#8fc2ff');
  }, [active, uniforms]);

  useFrame((_, delta) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.time.value += delta / 3;
  });

  return (
    <shaderMaterial
      ref={materialRef}
      attach="material-1"
      transparent
      side={DoubleSide}
      uniforms={uniforms}
      vertexShader={SIDE_SCAN_VERTEX_SHADER}
      fragmentShader={SIDE_SCAN_FRAGMENT_SHADER}
    />
  );
}

function BoundaryFadeMaterial({ depth }: { depth: number }) {
  const uniforms = useMemo(() => ({
    uColor: { value: new Color('#8fc2ff') },
    uOpacity: { value: 0.2 },
    uDepth: { value: depth },
  }), [depth]);

  return (
    <shaderMaterial
      transparent
      depthTest={false}
      side={DoubleSide}
      uniforms={uniforms}
      vertexShader={BOUNDARY_VERTEX_SHADER}
      fragmentShader={BOUNDARY_FRAGMENT_SHADER}
    />
  );
}

function CityRegion({ region, bbox, active, onSelect }: { region: MapRegion; bbox: Box2; active: boolean; onSelect: (name: string) => void }) {
  const normalMap = useTexture(scNormalMap);
  const groupRef = useRef<Group>(null);
  const targetScale = useRef(1);

  useEffect(() => {
    targetScale.current = active ? 1.5 : 1;
  }, [active]);

  useEffect(() => {
    normalMap.wrapS = normalMap.wrapT = RepeatWrapping;
  }, [normalMap]);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.scale.z += (targetScale.current - groupRef.current.scale.z) * 0.12;
  });

  return (
    <object3D
      ref={groupRef}
      onPointerOver={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        targetScale.current = 1.5;
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        targetScale.current = active ? 1.5 : 1;
        document.body.style.cursor = 'auto';
      }}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect(region.name);
      }}
    >
      <ShapeBox shapes={region.shapes} bbox={bbox}>
        <meshStandardMaterial
          attach="material-0"
          color={active ? '#3b5f9f' : '#293b41'}
          normalMap={normalMap}
          metalness={0.5}
          roughness={0.7}
          emissive={active ? '#3061db' : '#10182c'}
          emissiveIntensity={active ? 0.18 : 0.04}
          transparent
          opacity={0}
          side={DoubleSide}
        />
        <MapSideScanMaterial depth={MAP_DEPTH} active={active} />
      </ShapeBox>
      <lineSegments position={[0, 0, MAP_DEPTH + 0.04]} raycast={() => null}>
        <edgesGeometry args={[region.shapeGeometry]} />
        <lineBasicMaterial color="#ffffff" transparent opacity={0} depthTest={false} />
      </lineSegments>
    </object3D>
  );
}

function RegionLabels({ regions, visible }: { regions: MapRegion[]; visible: boolean }) {
  if (!visible) return null;
  return (
    <group>
      {regions.map((region) => (
        <Html key={region.name} center position={[region.center.x, region.center.y, MAP_DEPTH + 0.28]} distanceFactor={10} zIndexRange={[120, 0]}>
          <span className="ams3d-map-label">{region.name}</span>
        </Html>
      ))}
    </group>
  );
}

function Boundary({ shapes, depth = 3 }: { shapes: Shape[]; depth?: number }) {
  if (shapes.length === 0) return null;
  return (
    <group renderOrder={11} position-z={MAP_DEPTH} raycast={() => null}>
      <mesh>
        <extrudeGeometry args={[shapes, { depth, bevelEnabled: false }]} />
        <BoundaryFadeMaterial depth={depth} />
      </mesh>
    </group>
  );
}

function setPlanarUv(geometry: ShapeGeometry, bbox: Box2) {
  const position = geometry.attributes.position;
  if (!position) return;
  const width = bbox.max.x - bbox.min.x || 1;
  const height = bbox.max.y - bbox.min.y || 1;
  const uv: number[] = [];
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    uv.push((x - bbox.min.x) / width, (y - bbox.min.y) / height);
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
}

function TerrainSurface({ regions, bbox }: { regions: MapRegion[]; bbox: Box2 }) {
  const terrainMap = useTexture(scTerrainMap);
  const reliefMap = useTexture(scReliefMap);

  useEffect(() => {
    terrainMap.wrapS = terrainMap.wrapT = RepeatWrapping;
    reliefMap.wrapS = reliefMap.wrapT = RepeatWrapping;
  }, [reliefMap, terrainMap]);

  useLayoutEffect(() => {
    regions.forEach((region) => setPlanarUv(region.shapeGeometry, bbox));
  }, [bbox, regions]);

  return (
    <group renderOrder={8} position-z={MAP_DEPTH + 0.18} raycast={() => null}>
      {regions.map((region) => (
        <group key={region.name}>
          <mesh geometry={region.shapeGeometry} renderOrder={8}>
            <meshBasicMaterial
              map={terrainMap}
              color="#8fc2ff"
              transparent
              opacity={0}
              depthTest={false}
              depthWrite={false}
              userData={{ maxOpacity: 0.34 }}
            />
          </mesh>
          <mesh geometry={region.shapeGeometry} position-z={0.014} renderOrder={9}>
            <meshBasicMaterial
              map={reliefMap}
              color="#ffffff"
              transparent
              opacity={0}
              depthTest={false}
              depthWrite={false}
              blending={AdditiveBlending}
              userData={{ maxOpacity: 0.42 }}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BoundaryOutline({ rings }: { rings: Vector3[][] }) {
  const curves = useMemo(() => rings.map((ring) => new CatmullRomCurve3(ring, true, 'catmullrom', 0.08)), [rings]);

  if (curves.length === 0) return null;
  return (
    <group renderOrder={13} raycast={() => null}>
      {curves.map((curve, index) => (
        <mesh key={index} renderOrder={17}>
          <tubeGeometry args={[curve, Math.max(96, rings[index].length), 0.035, 5, true]} />
          <meshBasicMaterial color="#d7e6ff" transparent opacity={0} depthTest={false} blending={AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function RegionOutlines({ regions }: { regions: MapRegion[] }) {
  const rings = useMemo(() => regions.flatMap((region) => region.outlineRings), [regions]);
  const curves = useMemo(() => rings.map((ring) => new CatmullRomCurve3(ring, true, 'catmullrom', 0.08)), [rings]);

  if (curves.length === 0) return null;
  return (
    <group renderOrder={12} raycast={() => null}>
      {curves.map((curve, index) => (
        <mesh key={index} renderOrder={16}>
          <tubeGeometry args={[curve, Math.max(48, rings[index].length), 0.012, 4, true]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthTest={false} blending={AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function BeamLights() {
  const groupRef = useRef<Group>(null);
  const beams = useMemo(() => Array.from({ length: 26 }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const lane = Math.floor(index / 2) % 4;
    const depthLane = Math.floor(index / 8);
    return {
      x: side * (6.6 + lane * 1.35),
      y: 1 + ((index * 1.73) % 5),
      z: -6.6 + depthLane * 3.2 + ((index * 0.41) % 1.4),
      scaleY: 2.4 + ((index * 0.37) % 3.2),
      speed: 1.6 + ((index * 0.19) % 1.4),
      resetHeight: 9 + ((index * 0.53) % 9),
    };
  }), []);

  useFrame((_, delta) => {
    groupRef.current?.children.forEach((beam) => {
      beam.position.y += beam.userData.speed * delta;
      if (beam.position.y > beam.userData.resetHeight) {
        beam.position.y = -2 - ((beam.userData.seed as number) % 4);
      }
    });
  });

  return (
    <group ref={groupRef} raycast={() => null}>
      {beams.map((beam, index) => (
        <mesh
          key={index}
          position={[beam.x, beam.y, beam.z]}
          scale={[1, beam.scaleY, 1]}
          userData={{ speed: beam.speed, resetHeight: beam.resetHeight, seed: index }}
        >
          <cylinderGeometry args={[0.035, 0.035, 1, 6, 1, true]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            depthTest={false}
            side={DoubleSide}
            blending={AdditiveBlending}
            uniforms={{
              uColor: { value: new Color('#8fc2ff') },
              uOpacity: { value: 0.42 + (index % 4) * 0.07 },
            }}
            vertexShader={BEAM_VERTEX_SHADER}
            fragmentShader={BEAM_FRAGMENT_SHADER}
          />
        </mesh>
      ))}
    </group>
  );
}

function BottomHalo() {
  const meshRef = useRef<Mesh>(null);
  const outerRef = useRef<Mesh>(null);
  const texture = useTexture(bottomHaloTexture);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.z += delta / 5;
    if (outerRef.current) outerRef.current.rotation.z -= delta / 8;
  });

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position-y={-0.01} raycast={() => null}>
      <mesh ref={outerRef} renderOrder={1} scale={[1.22, 1.22, 1]}>
        <planeGeometry args={[16, 16]} />
        <meshBasicMaterial
          transparent
          map={texture}
          color="#3061db"
          opacity={0.38}
          depthWrite={false}
          depthTest={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh ref={meshRef} renderOrder={2}>
        <planeGeometry args={[16, 16]} />
        <meshBasicMaterial
          transparent
          map={texture}
          color="#8fc2ff"
          opacity={0.95}
          depthWrite={false}
          depthTest={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function CityMarker({ position }: { position: Vector3 }) {
  const coneRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);
  const dirRef = useRef<1 | -1>(1);

  useFrame((_, delta) => {
    if (coneRef.current) {
      if (coneRef.current.position.z >= 1) {
        dirRef.current = -1;
        coneRef.current.position.z = 1;
      }
      if (coneRef.current.position.z <= 0) {
        dirRef.current = 1;
        coneRef.current.position.z = 0;
      }
      coneRef.current.rotation.y += delta;
      coneRef.current.position.z += (dirRef.current * delta) / 2;
    }
    if (ringRef.current) ringRef.current.rotation.z += delta + 0.02;
  });

  const ringTexture = useTexture(cityRingTexture);
  return (
    <group position={[position.x, position.y, 0]} raycast={() => null}>
      <mesh ref={coneRef} rotation-x={-Math.PI / 2} position-z={0} renderOrder={18}>
        <coneGeometry args={[0.25, 0.52, 4]} />
        <meshBasicMaterial color="#8fc2ff" side={DoubleSide} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh ref={ringRef} renderOrder={18}>
        <planeGeometry args={[0.78, 0.78]} />
        <meshBasicMaterial transparent color="#8fc2ff" alphaMap={ringTexture} opacity={1} depthTest={false} fog={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CityMarkers({ regions }: { regions: MapRegion[] }) {
  return <group position-z={MAP_DEPTH} renderOrder={5}>{regions.map((region) => <CityMarker key={region.name} position={region.center} />)}</group>;
}

function FlyLines({ regions }: { regions: MapRegion[] }) {
  const texture = useTexture(flyLineTexture);
  useEffect(() => {
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(0.5, 2);
  }, [texture]);

  const curves = useMemo(() => {
    const hub = regions[0];
    if (!hub) return [];
    const hubCenter = new Vector3(hub.center.x, hub.center.y, 0);
    return regions.map((region) => {
      const point = new Vector3(region.center.x, region.center.y, 0);
      const mid = new Vector3().addVectors(hubCenter, point).multiplyScalar(0.5).setZ(5);
      return new QuadraticBezierCurve3(hubCenter, mid, point);
    });
  }, [regions]);

  useFrame((_, delta) => {
    texture.offset.x -= delta / 5;
  });

  return (
    <group renderOrder={10} position-z={MAP_DEPTH + 0.1} raycast={() => null}>
      {curves.map((curve, index) => (
        <mesh key={index} renderOrder={19}>
          <tubeGeometry args={[curve, 32, 0.1, 2, false]} />
          <meshBasicMaterial transparent color="#ffffff" fog={false} map={texture} opacity={0} depthTest={false} depthWrite={false} blending={AdditiveBlending} toneMapped={false} userData={{ maxOpacity: 1.15 }} />
        </mesh>
      ))}
    </group>
  );
}

function BoundaryFollower({ points }: { points: Vector3[] }) {
  const follower = useRef<Group>(null);
  const t = useRef(0);
  const color = useMemo(() => new Color(2, 10, 10), []);

  useFrame((_, delta) => {
    if (!follower.current || points.length === 0) return;
    t.current = (t.current + delta / 8) % 1;
    const point = points[Math.floor(t.current * points.length) % points.length];
    follower.current.position.copy(point);
  });

  if (points.length === 0) return null;
  return (
    <Trail width={1} length={10} color={color} attenuation={(value) => value * value}>
      <group ref={follower} position={points[points.length - 1]} raycast={() => null} />
    </Trail>
  );
}

function MirrorPlane() {
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position-y={-0.02} raycast={() => null} renderOrder={-10}>
      <planeGeometry args={[100, 100]} />
      <MeshReflectorMaterial
        mirror={0.18}
        blur={[180, 80]}
        resolution={512}
        mixBlur={3}
        mixStrength={1.6}
        depthScale={0.55}
        minDepthThreshold={0.85}
        color="#011024"
        metalness={0.42}
        roughness={1}
      />
    </mesh>
  );
}

function MapIntro({ groupRef, onComplete }: { groupRef: React.RefObject<Group>; onComplete: () => void }) {
  const camera = useThree((state) => state.camera);
  const doneRef = useRef(false);
  const start = useMemo(() => new Vector3(3, 20, 10), []);
  const end = useMemo(() => new Vector3(-2, 7, 10), []);

  useFrame(({ clock }) => {
    if (doneRef.current) return;
    const progress = Math.min(clock.getElapsedTime() / 2.5, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    camera.position.copy(start).lerp(end, eased);
    camera.lookAt(0, 0, 0);
    if (groupRef.current) {
      groupRef.current.scale.set(1, 1, eased);
      groupRef.current.traverse((object) => setTreeOpacity(object, eased));
    }
    if (progress >= 1) {
      doneRef.current = true;
      onComplete();
    }
  });

  return null;
}

function SichuanMapScene({ selectedCity, onSelectCity, onIntroComplete }: { selectedCity: string | null; onSelectCity: (name: string) => void; onIntroComplete: () => void }) {
  const model = useMemo(() => makeMapModel(sichuanGeoData, sichuanOutlineGeoData), []);
  const mapGroupRef = useRef<Group>(null);
  const [labelsReady, setLabelsReady] = useState(false);

  const handleIntroComplete = () => {
    setLabelsReady(true);
    onIntroComplete();
  };

  return (
    <>
      <fog attach="fog" args={['#000000', 10, 30]} />
      <color attach="background" args={['#000000']} />
      <ambientLight color={0xffffff} intensity={2} />
      <directionalLight color="#ffffff" intensity={10} position={[0, 50, -50]} />
      <MapIntro groupRef={mapGroupRef} onComplete={handleIntroComplete} />
      <Center top>
        <group rotation={[-Math.PI / 2, 0, 0]} scale={[0.5, 0.5, 0.5]} position={[0, 0.2, 0]}>
          <group ref={mapGroupRef} scale={[1, 1, 0]} position={[0, 0, -0.01]}>
            {model.regions.map((region) => (
              <CityRegion key={region.name} region={region} bbox={model.bbox} active={selectedCity === region.name} onSelect={onSelectCity} />
            ))}
            <TerrainSurface regions={model.regions} bbox={model.bbox} />
            <RegionOutlines regions={model.regions} />
            <Boundary shapes={model.boundary} />
            <BoundaryOutline rings={model.boundaryRings} />
            <CityMarkers regions={model.regions} />
            <FlyLines regions={model.regions} />
            <BoundaryFollower points={model.boundaryPoints} />
            <RegionLabels regions={model.regions} visible={labelsReady} />
          </group>
        </group>
      </Center>
      <BottomHalo />
      <MirrorPlane />
      <BeamLights />
      <OrbitControls enableDamping zoomSpeed={0.3} minDistance={8} maxDistance={20} maxPolarAngle={1.5} />
    </>
  );
}

function buildCityMetrics(stats: Stats): CityMetric[] {
  const names = sichuanGeoData.features.map((feature) => feature.properties.name);
  const totalWeight = names.reduce((sum, _, index) => sum + (cityWeights[index] ?? 0.02), 0);
  return names.map((name, index) => {
    const ratio = (cityWeights[index] ?? 0.02) / totalWeight;
    return {
      name,
      assetCount: Math.max(2, Math.round(stats.totalAssets * ratio)),
      onlineRate: Math.max(82, Math.min(99.8, 94 + ((index * 7) % 10) / 2)),
      warningCount: Math.max(0, Math.round(stats.criticalAlerts * ratio + (index % 3 === 0 ? 1 : 0))),
      netValue: Math.round(stats.netValue * ratio),
    };
  });
}

function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => setScale(Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return scale;
}

export default function BigScreen3DPage() {
  const stageScale = useStageScale();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [time, setTime] = useState(new Date());

  const { data: apiStats } = useQuery<Stats>({
    queryKey: ['dashboard', 'stats', 'demo2-style'],
    queryFn: async () => {
      try {
        const res = await http.get<any>('/dashboard/stats');
        const raw = res?.data ?? res ?? {};
        const total = typeof raw.totalAssets === 'number' ? raw.totalAssets : fallbackStats.totalAssets;
        const inUse = typeof raw.inUseAssets === 'number' ? raw.inUseAssets : fallbackStats.inUseAssets;
        return {
          ...fallbackStats,
          totalAssets: total,
          inUseAssets: inUse,
          idleAssets: typeof raw.idleAssets === 'number' ? raw.idleAssets : fallbackStats.idleAssets,
          scrapAssets: typeof raw.scrapAssets === 'number' ? raw.scrapAssets : fallbackStats.scrapAssets,
          utilizationRate: total > 0 ? Math.round((inUse / total) * 1000) / 10 : fallbackStats.utilizationRate,
          totalValue: typeof raw.totalValue === 'number' ? raw.totalValue : fallbackStats.totalValue,
          netValue: typeof raw.netValue === 'number' ? raw.netValue : fallbackStats.netValue,
          pendingApprovals: typeof raw.pendingApprovals === 'number' ? raw.pendingApprovals : fallbackStats.pendingApprovals,
          pendingWorkOrders: typeof raw.pendingWorkOrders === 'number' ? raw.pendingWorkOrders : fallbackStats.pendingWorkOrders,
          inventoryProgress: typeof raw.inventoryProgress === 'number' ? raw.inventoryProgress : fallbackStats.inventoryProgress,
          criticalAlerts: typeof raw.criticalAlerts === 'number' ? raw.criticalAlerts : fallbackStats.criticalAlerts,
        };
      } catch {
        return fallbackStats;
      }
    },
    initialData: fallbackStats,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
    throwOnError: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = apiStats ?? fallbackStats;
  const cityMetrics = useMemo(() => buildCityMetrics(stats), [stats]);
  const selectedMetric = cityMetrics.find((item) => item.name === selectedCity) ?? cityMetrics.find((item) => item.name.includes('成都')) ?? cityMetrics[0];
  const topCities = cityMetrics.slice().sort((a, b) => b.assetCount - a.assetCount).slice(0, 5);
  const dateText = `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, '0')}-${String(time.getDate()).padStart(2, '0')}`;
  const timeText = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}:${String(time.getSeconds()).padStart(2, '0')}`;

  return (
    <div className="ams3d-page">
      <style>{CSS}</style>
      <div className="ams3d-map-layer">
        <Canvas
          camera={{ fov: 70, position: [3, 20, 10] }}
          dpr={[1, 1.5]}
          gl={{ alpha: false, antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => gl.setClearColor('#000000', 1)}
        >
          <SichuanMapScene selectedCity={selectedCity} onSelectCity={setSelectedCity} onIntroComplete={() => setMapReady(true)} />
        </Canvas>
      </div>

      <div className="ams3d-stage" style={{ '--stage-scale': stageScale } as StyleVars}>
        <header className="ams3d-header">
          <HeaderRail />
          <div className="ams3d-meta">
            <span>开场动画：<strong>{mapReady ? '完成' : '播放中'}</strong></span>
            <span>当前城市：<strong>{selectedCity ?? '四川全域'}</strong></span>
          </div>
          <div className="ams3d-title">
            <div className="ams3d-title-main"><Radio size={28} />固定资产智慧运营大屏</div>
            <div className="ams3d-title-sub">FIXED ASSET INTELLIGENCE PLATFORM</div>
          </div>
          <div className="ams3d-status">
            <span>{dateText}</span>
            <span><strong>{timeText}</strong></span>
            <span>地图节点：<strong>{cityMetrics.length}</strong></span>
          </div>
        </header>

        <main className="ams3d-grid">
          <Panel side="left" style={{ gridArea: '1 / 1 / 3 / 2' }} title="资产规模指标" tag="SUMMARY" icon={<Gauge size={18} />}>
            <div className="ams3d-kpis">
              <div className="ams3d-kpi"><span>资产总数</span><strong><NumberTicker value={stats.totalAssets} options={{ maximumFractionDigits: 0 }} /><small>件</small></strong></div>
              <div className="ams3d-kpi"><span>在用资产</span><strong><NumberTicker value={stats.inUseAssets} options={{ maximumFractionDigits: 0 }} /><small>件</small></strong></div>
              <div className="ams3d-kpi"><span>资产原值</span><strong>{formatWan(stats.totalValue)}</strong></div>
              <div className="ams3d-kpi"><span>资产净值</span><strong>{formatWan(stats.netValue)}</strong></div>
            </div>
          </Panel>

          <Panel side="left" style={{ gridArea: '3 / 1 / 5 / 2' }} title="资产分类结构" tag="CATEGORY" icon={<Boxes size={18} />}>
            <div className="ams3d-bars">
              {categoryBands.map((item) => (
                <div key={item.label} className="ams3d-bar-row" style={{ '--tone': item.tone, '--pct': `${item.value}%` } as StyleVars}>
                  <span>{item.label}</span>
                  <div className="ams3d-bar-track"><div className="ams3d-bar-fill" /></div>
                  <span className="ams3d-bar-num">{item.value}%</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel side="left" style={{ gridArea: '5 / 1 / 7 / 2' }} title="价值趋势预测" tag="FORECAST" icon={<Activity size={18} />}>
            <LinePreview />
          </Panel>

          <Panel side="right" style={{ gridArea: '1 / 4 / 3 / 5' }} title="设备在线总览" tag="IOT" icon={<Database size={18} />}>
            <DeviceGrid />
          </Panel>

          <Panel side="right" style={{ gridArea: '3 / 4 / 5 / 5' }} title="城市资产TOP5" tag="TOP 5" icon={<RotateCcw size={18} />}>
            <div className="ams3d-city-list">
              {topCities.map((city) => (
                <div key={city.name} className="ams3d-city-row" style={{ '--pct': `${Math.min(100, city.assetCount * 8)}%` } as StyleVars}>
                  <strong>{city.name}</strong><div className="ams3d-city-track"><div className="ams3d-city-fill" /></div><span>{city.assetCount}</span>
                </div>
              ))}
            </div>
            <div className="ams3d-focus">
              <strong>{selectedMetric?.name ?? '成都市'}</strong>
              资产 {selectedMetric?.assetCount ?? 0} 件，在线率 {(selectedMetric?.onlineRate ?? 0).toFixed(1)}%，净值 {formatWan(selectedMetric?.netValue ?? 0)}。
            </div>
          </Panel>

          <Panel side="right" style={{ gridArea: '5 / 4 / 7 / 5' }} title="风险异常队列" tag="WARNING" icon={<AlertTriangle size={18} />}>
            <WarningTable />
          </Panel>

          <div className="ams3d-bottom-halo" />
        </main>
      </div>
    </div>
  );
}
