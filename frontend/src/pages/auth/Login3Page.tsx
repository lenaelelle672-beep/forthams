import { useEffect, useRef, useMemo } from 'react';
import { Shield } from 'lucide-react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Billboard, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useLoginForm } from './hooks/useLoginForm';
import { LoginFormFields, DemoAccounts, SsoButton } from './components';

/* ════════════════════════════════════════════════════════════════════════════════
   Login3 — Uniview 宇视科技 · 流星安防宇宙
   真实产品渲染图 × 流星长拖尾动画 × 电影级粒子系统
   ════════════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════════════
   产品数据 — 并排彗星群
   2~3 个一组并排飞，统一蓝色长尾巴
   ════════════════════════════════════════════════════════════════════════════════ */
const PRODUCTS = [
  { name: '枪机 IPC',   img: '/images/products/bullet_camera.png',  size: 2.0,  delay: 0,    speed: 1.15, sy0: 12,  ey: -8,   angle: 0.04,  depth: 0    },
  { name: '球机 PTZ',   img: '/images/products/ptz_dome.png',       size: 1.5,  delay: 0.7,  speed: 1.35, sy0: -10, ey: 5,    angle: -0.03, depth: -1.5 },
  { name: 'NVR 存储',   img: '/images/products/nvr_recorder.png',   size: 2.2,  delay: 1.2,  speed: 0.9,  sy0: -3,  ey: -12,  angle: -0.02, depth: 1    },
  { name: '门禁面板',   img: '/images/products/access_control.png', size: 1.3,  delay: 2.8,  speed: 1.5,  sy0: 8,   ey: -5,   angle: 0.06,  depth: -0.5 },
  { name: 'PoE 交换机', img: '/images/products/network_switch.png', size: 1.7,  delay: 3.3,  speed: 1.05, sy0: -12, ey: 8,    angle: -0.05, depth: 0.5  },
  { name: '拼接屏',     img: '/images/products/video_wall.png',     size: 1.9,  delay: 4.1,  speed: 1.25, sy0: 5,   ey: -10,  angle: 0.03,  depth: 0    },
  // ── 第二波 ──
  { name: '枪机 IPC',   img: '/images/products/bullet_camera.png',  size: 1.4,  delay: 5.6,  speed: 1.4,  sy0: -7,  ey: 6,    angle: 0.02,  depth: -2   },
  { name: 'NVR 存储',   img: '/images/products/nvr_recorder.png',   size: 1.6,  delay: 5.9,  speed: 1.1,  sy0: 14,  ey: -4,   angle: -0.04, depth: 0.5  },
  { name: '球机 PTZ',   img: '/images/products/ptz_dome.png',       size: 2.1,  delay: 7.2,  speed: 0.85, sy0: -5,  ey: 10,   angle: 0.05,  depth: 1.5  },
  { name: '拼接屏',     img: '/images/products/video_wall.png',     size: 1.5,  delay: 7.8,  speed: 1.3,  sy0: -14, ey: 3,    angle: -0.02, depth: -1   },
  { name: '门禁面板',   img: '/images/products/access_control.png', size: 1.8,  delay: 9.0,  speed: 1.2,  sy0: 3,   ey: -11,  angle: 0.03,  depth: 0    },
  { name: 'PoE 交换机', img: '/images/products/network_switch.png', size: 1.2,  delay: 9.6,  speed: 1.45, sy0: -8,  ey: 12,   angle: -0.06, depth: -1   },
];

/** 蓝色 #0ea5e9 统一尾焰色 */
const TRAIL_BLUE = '#0ea5e9';

/** 飞行产品 — 径向无方框 + 粒子散落 */
function MeteorProduct({ img, size, delay, speed, sy0, ey, angle, depth }: typeof PRODUCTS[number]) {
  const texture = useLoader(THREE.TextureLoader, img);
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const prodRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const particlesRef = useRef<THREE.Points>(null);

  useMemo(() => {
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
  }, [texture]);

  // 80 个散落粒子
  const PC = 80;
  const { pPos, pCol, pAlpha } = useMemo(() => ({
    pPos: new Float32Array(PC * 3),
    pCol: new Float32Array(PC * 3),
    pAlpha: new Float32Array(PC),
  }), []);
  const pAge = useMemo(() => { const a = new Float32Array(PC); a.fill(999); return a; }, []);
  const pVel = useMemo(() => new Float32Array(PC * 3), []);
  const spawnT = useRef(0);
  const blueC = useMemo(() => new THREE.Color(TRAIL_BLUE), []);

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    const cycle = 12;
    const prog = ((t * speed + delay) % cycle) / cycle;

    const sx = -24, sy = sy0, sz = -14 + depth;
    const ex = 28, eyv = ey, ez = -2 + depth * 0.3;
    const dx = ex - sx, dy = eyv - sy, dz = ez - sz;
    const x = sx + dx * prog + Math.sin(angle * prog * 20) * 1.2;
    const y = sy + dy * prog + Math.cos(angle * prog * 15) * 0.6;
    const z = sz + dz * prog;

    if (groupRef.current) groupRef.current.position.set(x, y, z);

    const fadeIn = Math.min(1, ((t * speed + delay) % cycle) / 0.5);
    const fadeOut = Math.min(1, (cycle - ((t * speed + delay) % cycle)) / 0.6);
    const alpha = Math.min(fadeIn, fadeOut);

    if (prodRef.current) (prodRef.current.material as THREE.ShaderMaterial).uniforms.uA.value = 0.95 * alpha;
    if (glowRef.current) (glowRef.current.material as THREE.ShaderMaterial).uniforms.uA.value = 0.12 * alpha;
    if (lightRef.current) lightRef.current.intensity = 3 * alpha;

    // ── 散落粒子 ──
    const pts = particlesRef.current;
    if (pts) {
      const posA = pts.geometry.attributes.position as THREE.BufferAttribute;
      const colA = pts.geometry.attributes.color as THREE.BufferAttribute;
      const alpA = pts.geometry.attributes.alpha as THREE.BufferAttribute;

      spawnT.current += dt;
      if (spawnT.current > 0.03 && alpha > 0.08) {
        spawnT.current = 0;
        for (let j = 0; j < PC; j++) {
          if (pAge[j] > 3) {
            const j3 = j * 3;
            pPos[j3] = x + (Math.random() - 0.5) * 1.5;
            pPos[j3 + 1] = y + (Math.random() - 0.5) * 1.5;
            pPos[j3 + 2] = z + (Math.random() - 0.5) * 0.5;
            pVel[j3] = (Math.random() - 0.5) * 1.2;
            pVel[j3 + 1] = (Math.random() - 0.5) * 1.2;
            pVel[j3 + 2] = (Math.random() - 0.5) * 0.3;
            pAge[j] = 0;
            break;
          }
        }
      }

      for (let i = 0; i < PC; i++) {
        pAge[i] += dt;
        const i3 = i * 3;
        const fade = Math.max(0, 1 - (pAge[i] / 3) * (pAge[i] / 3));
        posA.setXYZ(i, pPos[i3] + pVel[i3] * pAge[i], pPos[i3 + 1] + pVel[i3 + 1] * pAge[i], pPos[i3 + 2] + pVel[i3 + 2] * pAge[i]);
        colA.setXYZ(i, blueC.r * fade, blueC.g * fade, blueC.b * fade);
        pAlpha[i] = fade * alpha * 0.7;
      }
      posA.needsUpdate = true;
      colA.needsUpdate = true;
      alpA.needsUpdate = true;
    }
  });

  const tc = useMemo(() => new THREE.Color(TRAIL_BLUE), []);

  return (
    <group ref={groupRef}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        {/* 产品图片 — 径向渐隐无方框 */}
        <mesh ref={prodRef} position={[0, 0, 0.01]}>
          <planeGeometry args={[size, size]} />
          <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}
            uniforms={{ uTex: { value: texture }, uA: { value: 0.95 } }}
            vertexShader={`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
            fragmentShader={`
              uniform sampler2D uTex;uniform float uA;varying vec2 v;
              void main(){
                vec4 tx=texture2D(uTex,v);
                float d=length(v-0.5)*2.0;
                float r=1.0-smoothstep(0.55,1.0,d);
                gl_FragColor=vec4(tx.rgb,tx.a*r*uA);
              }`}
          />
        </mesh>

        {/* 产品径向辉光 */}
        <mesh ref={glowRef} position={[0, 0, -0.02]}>
          <planeGeometry args={[size * 1.6, size * 1.6]} />
          <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending}
            uniforms={{ uC: { value: tc }, uA: { value: 0.12 } }}
            vertexShader={`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
            fragmentShader={`
              uniform vec3 uC;uniform float uA;varying vec2 v;
              void main(){
                float d=length(v-0.5)*2.0;
                float r=pow(max(1.0-smoothstep(0.0,1.0,d),0.0),2.5);
                gl_FragColor=vec4(uC,r*uA);
              }`}
          />
        </mesh>
      </Billboard>

      <pointLight ref={lightRef} color={TRAIL_BLUE} intensity={3} distance={10} decay={2} />

      {/* 散落粒子 */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={PC} array={pPos} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={PC} array={pCol} itemSize={3} />
          <bufferAttribute attach="attributes-alpha" count={PC} array={pAlpha} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending}
          vertexShader={`
            attribute float alpha;varying float vA;varying vec3 vC;
            void main(){vA=alpha;vC=color;vec4 mv=modelViewMatrix*vec4(position,1.);
            gl_PointSize=max(1.,160./-mv.z*alpha);gl_Position=projectionMatrix*mv;}`}
          fragmentShader={`
            varying float vA;varying vec3 vC;
            void main(){float d=length(gl_PointCoord-.5)*2.;float c=1.-smoothstep(0.,.7,d);
            gl_FragColor=vec4(vC,c*vA);}`}
          vertexColors
        />
      </points>
    </group>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════
   科幻环境
   ════════════════════════════════════════════════════════════════════════════════ */

/** 垂直光柱 */
function LightBeams() {
  const beams = useMemo(() => [
    { pos: [-10, 0, -14] as [number, number, number], h: 30, c: '#0ea5e9' },
    { pos: [4, 0, -18] as [number, number, number], h: 28, c: '#7c3aed' },
    { pos: [-14, 0, -5] as [number, number, number], h: 24, c: '#22d3ee' },
    { pos: [7, 0, -12] as [number, number, number], h: 26, c: '#3b82f6' },
    { pos: [-7, 0, -22] as [number, number, number], h: 32, c: '#0ea5e9' },
    { pos: [10, 0, -20] as [number, number, number], h: 22, c: '#6366f1' },
    { pos: [-18, 0, -15] as [number, number, number], h: 20, c: '#22d3ee' },
  ], []);
  return (
    <>
      {beams.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <cylinderGeometry args={[0.025, 0.025, b.h, 6]} />
          <meshBasicMaterial color={b.c} transparent opacity={0.06} />
        </mesh>
      ))}
    </>
  );
}

/** 3000 粒子 — 加法混合辉光 */
function ParticleField() {
  const ref = useRef<THREE.Points>(null);
  const N = 3000;
  const { pos, col, spd, ph } = useMemo(() => {
    const p = new Float32Array(N * 3), c = new Float32Array(N * 3), s = new Float32Array(N), h = new Float32Array(N);
    const tc = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const th = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1), r = 2 + Math.random() * 18;
      p[i3] = Math.sin(phi) * Math.cos(th) * r - 3; p[i3 + 1] = Math.cos(phi) * r * 0.5; p[i3 + 2] = Math.sin(phi) * Math.sin(th) * r - 6;
      tc.setHSL(0.5 + Math.random() * 0.16, 0.55, 0.25 + Math.random() * 0.4);
      c[i3] = tc.r; c[i3 + 1] = tc.g; c[i3 + 2] = tc.b;
      s[i] = 0.01 + Math.random() * 0.05; h[i] = Math.random() * Math.PI * 2;
    }
    return { pos: p, col: c, spd: s, ph: h };
  }, []);
  useFrame(({ clock }) => {
    const pts = ref.current; if (!pts) return;
    const t = clock.getElapsedTime();
    const a = pts.geometry.attributes.position as THREE.BufferAttribute;
    const ca = pts.geometry.attributes.color as THREE.BufferAttribute;
    const tc = new THREE.Color();
    for (let i = 0; i < N; i++) {
      let y = a.getY(i) + spd[i] * 0.005; if (y > 12) y = -12; a.setY(i, y);
      a.setX(i, a.getX(i) + Math.sin(t * 0.12 + ph[i]) * 0.0015);
      const hn = (y + 12) / 24; tc.setHSL(0.48 + hn * 0.16, 0.6, 0.18 + hn * 0.38);
      ca.setXYZ(i, tc.r, tc.g, tc.b);
    }
    a.needsUpdate = true; ca.needsUpdate = true;
  });
  return (
    <points ref={ref}><bufferGeometry>
      <bufferAttribute attach="attributes-position" count={N} array={pos} itemSize={3} />
      <bufferAttribute attach="attributes-color" count={N} array={col} itemSize={3} />
    </bufferGeometry>
    <pointsMaterial size={0.04} vertexColors transparent opacity={0.6} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} /></points>
  );
}

/** 数据雨 */
function DataRain() {
  const ref = useRef<THREE.Points>(null);
  const N = 500;
  const { pos, spd } = useMemo(() => {
    const p = new Float32Array(N * 3), s = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      p[i3] = (Math.random() - 0.5) * 40 - 3; p[i3 + 1] = Math.random() * 25 - 5; p[i3 + 2] = (Math.random() - 0.5) * 30 - 6;
      s[i] = 0.025 + Math.random() * 0.07;
    }
    return { pos: p, spd: s };
  }, []);
  useFrame(() => {
    const pts = ref.current; if (!pts) return;
    const a = pts.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) { let y = a.getY(i) - spd[i]; if (y < -5) y = 20; a.setY(i, y); }
    a.needsUpdate = true;
  });
  return (
    <points ref={ref}><bufferGeometry>
      <bufferAttribute attach="attributes-position" count={N} array={pos} itemSize={3} />
    </bufferGeometry>
    <pointsMaterial size={0.02} color="#0ea5e9" transparent opacity={0.3} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} /></points>
  );
}

function MouseLight() {
  const ref = useRef<THREE.PointLight>(null);
  const t = useRef(new THREE.Vector3());
  useEffect(() => { const h = (e: MouseEvent) => { t.current.set((e.clientX / window.innerWidth - 0.5) * 18, -(e.clientY / window.innerHeight - 0.5) * 12, 10); }; window.addEventListener('mousemove', h); return () => window.removeEventListener('mousemove', h); }, []);
  useFrame(() => { if (ref.current) ref.current.position.lerp(t.current, 0.025); });
  return <pointLight ref={ref} color="#818cf8" intensity={2.5} distance={25} decay={2} />;
}

/** 完整场景 */
function Scene() {
  return (
    <>
      <LightBeams />

      {/* 6 个流星产品 */}
      {PRODUCTS.map((p, i) => <MeteorProduct key={i} {...p} />)}

      <ParticleField />
      <DataRain />
      <Stars radius={90} depth={70} count={1500} factor={3.5} saturation={0.05} fade speed={0.1} />

      <ambientLight intensity={0.18} color="#94a3b8" />
      <directionalLight position={[8, 12, 10]} intensity={0.5} color="#e2e8f0" />
      <pointLight position={[-12, 8, 5]} intensity={2} color="#0ea5e9" distance={30} decay={2} />
      <pointLight position={[6, -4, 8]} intensity={1} color="#7c3aed" distance={20} decay={2} />
      <MouseLight />
      <fog attach="fog" args={['#020617', 14, 55]} />
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════
   Login3Page
   ════════════════════════════════════════════════════════════════════════════════ */
export default function Login3Page() {
  const { form, errorMsg, rememberMe, setRememberMe, isPending, handleSubmit, fillAndLogin } = useLoginForm();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-slate-100 selection:bg-cyan-300/20">
      <div className="fixed inset-0">
        <Canvas camera={{ position: [0, 2, 16], fov: 52 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} dpr={[1, 2]} style={{ background: '#020617' }}
          onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.2; }}>
          <Scene />
        </Canvas>
      </div>

      {/* 遮罩 */}
      {/* 遮罩已移除 */}

      {/* HUD */}
      <div className="pointer-events-none fixed inset-0 z-[3]" aria-hidden>
        <div className="absolute left-7 top-7 hidden md:block">
          <p className="text-xl font-bold tracking-[0.1em] text-cyan-400">Uniview</p>
        </div>
        <div className="absolute right-7 top-7 hidden text-right md:block">
          <p className="font-mono text-[9px] tracking-[0.25em] text-slate-500">INTELLIGENT SECURITY</p>
          <p className="mt-0.5 font-mono text-[9px] tracking-[0.25em] text-slate-600">AIoT PLATFORM V3.0</p>
        </div>

        {/* 星球大气光晕 — 从屏幕最底部弧度延伸至右方 */}
        <div className="pointer-events-none absolute bottom-0 left-0 hidden h-full w-full md:block" aria-hidden>
          <svg className="h-full w-full" viewBox="-200 -200 1050 1100" preserveAspectRatio="none" fill="none">
            <defs>
              <filter id="nb1" x="-100%" y="-100%" width="400%" height="400%"><feGaussianBlur stdDeviation="32" /></filter>
              <filter id="nb2" x="-100%" y="-100%" width="400%" height="400%"><feGaussianBlur stdDeviation="18" /></filter>
              <filter id="nb3" x="-100%" y="-100%" width="400%" height="400%"><feGaussianBlur stdDeviation="7" /></filter>
              <linearGradient id="gD" x1="80" y1="900" x2="900" y2="100" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.12" />
                <stop offset="30%" stopColor="#38bdf8" stopOpacity="0.06" />
                <stop offset="65%" stopColor="#3b82f6" stopOpacity="0.02" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gE" x1="80" y1="900" x2="890" y2="110" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.15" />
                <stop offset="25%" stopColor="#38bdf8" stopOpacity="0.07" />
                <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.02" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gF" x1="80" y1="900" x2="870" y2="120" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.1" />
                <stop offset="20%" stopColor="#e0f2fe" stopOpacity="0.04" />
                <stop offset="55%" stopColor="#fff" stopOpacity="0.01" />
                <stop offset="100%" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              {/* SVG 原生 mask — 径向淡出消除边界 */}
              <radialGradient id="maskR" cx="80" cy="900" r="1100" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fff" />
                <stop offset="42%" stopColor="#fff" />
                <stop offset="100%" stopColor="#000" />
              </radialGradient>
              <mask id="glowMask" maskUnits="userSpaceOnUse" x="-500" y="-500" width="2000" height="2000">
                <rect x="-500" y="-500" width="2000" height="2000" fill="url(#maskR)" />
              </mask>
            </defs>
            <g mask="url(#glowMask)">
              <path d="M80,900 Q-50,250 900,100" stroke="url(#gD)" strokeWidth="280" strokeLinecap="round" fill="none" filter="url(#nb1)" />
              <path d="M80,900 Q-40,260 890,110" stroke="url(#gE)" strokeWidth="165" strokeLinecap="round" fill="none" filter="url(#nb2)" />
              <path d="M80,900 Q-30,270 870,125" stroke="url(#gF)" strokeWidth="60" strokeLinecap="round" fill="none" filter="url(#nb3)" />
            </g>
          </svg>
        </div>

        {/* 左侧主题文字 — 居中于左半区 */}
        <div className="absolute left-[18%] top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block lg:left-[22%]">
          <div className="space-y-5">
            <p className="text-[28px] font-light leading-tight tracking-[0.15em] text-white/90 lg:text-[34px]">
              智慧安防
            </p>
            <div className="h-px w-10 bg-gradient-to-r from-cyan-400/60 to-transparent" />
            <p className="text-[13px] font-light tracking-[0.2em] text-slate-300/80">
              全域资产 · 统一管理
            </p>
            <p className="font-mono text-[9px] tracking-[0.3em] text-slate-500/70">
              INTELLIGENT ASSET MANAGEMENT
            </p>
          </div>
        </div>
      </div>

      {/* 登录卡 */}
      <div className="relative z-10 flex min-h-screen items-center justify-end px-5 sm:px-14 lg:px-24">
        <div className="w-full max-w-[400px]">
          <div className="pv-card relative overflow-hidden rounded-[20px] border border-white/[0.07] bg-gradient-to-b from-[#0c1a2e]/80 to-[#070f1e]/90 p-7 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:p-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />

            <header className="mb-7">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 ring-1 ring-cyan-400/20">
                  <Shield className="h-5 w-5 text-cyan-300" />
                </div>
                <div>
                  <p className="text-base font-bold tracking-[0.06em] text-white">Uniview</p>
                  <p className="text-[10px] tracking-[0.18em] text-slate-400">宇视科技 · 安防管理平台</p>
                </div>
              </div>
              <h1 className="text-[21px] font-semibold leading-snug tracking-tight text-white">登录您的管理账户</h1>
              <p className="mt-1 text-[13px] text-slate-400">统一监控 · 资产管理 · 智能运维</p>
            </header>

            <LoginFormFields
              form={form}
              errorMsg={errorMsg}
              rememberMe={rememberMe}
              onRememberChange={setRememberMe}
              isPending={isPending}
              onSubmit={handleSubmit}
            />
            <SsoButton />
            <DemoAccounts onFillAndLogin={fillAndLogin} isPending={isPending} />
          </div>
          <div className="mt-4 flex items-center justify-between px-1">
            <a href="/login" className="text-[11px] text-slate-600 hover:text-slate-400">标准登录页</a>
            <p className="text-[10px] text-slate-700">&copy; 2026 Uniview 宇视科技</p>
          </div>
        </div>
      </div>

      <style>{`
        .pv-card::before{content:'';position:absolute;inset:-1px;border-radius:21px;padding:1px;
          background:linear-gradient(160deg,transparent 30%,rgba(14,165,233,.08) 50%,rgba(99,102,241,.05) 70%,transparent 90%);
          -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;
          animation:pvg 6s ease-in-out infinite;pointer-events:none;z-index:0;}
        .pv-card>*{position:relative;z-index:1;}
        @keyframes pvg{0%,100%{opacity:.2}50%{opacity:.8}}
      `}</style>
    </main>
  );
}
