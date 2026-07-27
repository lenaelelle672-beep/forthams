import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Shield, Activity,
} from 'lucide-react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Billboard, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useLoginForm } from './hooks/useLoginForm';
import { LoginFormFields, DemoAccounts, SsoButton } from './components';

/* ════════════════════════════════════════════════════════════════════════════════
   UNIVIEW 固定资产 Login2 — 宇视科技全息指挥中心
   ────────────────────────────────────────────────────────────────────────────────
   Three.js 3D 背景 + 宇视摄像机行星公转 + 中央品牌展示 + 点击交互

   交互: 点击 3D 背景 → 登录框下滑隐藏，展示全景；
         点击关闭按钮 → 登录框恢复
   ════════════════════════════════════════════════════════════════════════════════ */

// ── 常量 ────────────────────────────────────────────────────────────────────────

const STREAM_COUNT = 8;
const PARTICLES_PER_STREAM = 15;

/* ════════════════════════════════════════════════════════════════════════════════
   3D Scene Components
   ════════════════════════════════════════════════════════════════════════════════ */

/** 自定义地面网格 — 赛博朋克风格透视网格 */
function HoloGrid() {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#22d3ee') },
    uOpacity: { value: 1.0 },
  }), []);

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -2.5, 0]}>
      <planeGeometry args={[200, 200]} />
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec3 vWorldPos;
          void main() {
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          varying vec3 vWorldPos;
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uOpacity;

          float gridLine(vec2 p, float size) {
            vec2 g = abs(fract(p / size - 0.5) - 0.5) * size;
            float d = min(g.x, g.y);
            return 1.0 - smoothstep(0.0, 0.06, d);
          }

          void main() {
            float dist = length(vWorldPos.xz);
            float fade = 1.0 - smoothstep(2.0, 30.0, dist);

            float fine   = gridLine(vWorldPos.xz, 1.0) * 0.22;
            float medium = gridLine(vWorldPos.xz, 5.0) * 0.40;

            float pulse = sin(dist * 0.6 - uTime * 1.2) * 0.5 + 0.5;
            pulse *= exp(-dist * 0.05);
            float pulseLine = smoothstep(0.42, 0.5, pulse) * smoothstep(0.58, 0.5, pulse);

            float g = (fine + medium) * fade;
            vec3 col = uColor * (g + pulseLine * 0.35 * fade);
            gl_FragColor = vec4(col, (g * 0.7 + pulseLine * 0.25 * fade) * uOpacity);
          }
        `}
      />
    </mesh>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────
   产品广告牌 — 真实产品渲染图 (复刻自 Login3)
   ──────────────────────────────────────────────────────────────────────────────── */

const PRODUCTS = [
  { name: '枪机 IPC',   img: '/images/products/bullet_camera.png',  color: '#22d3ee', orbit: 5.5, height: 0.8,  angle: 0.0,  speed: 0.075 },
  { name: '球机 PTZ',   img: '/images/products/ptz_dome.png',       color: '#3b82f6', orbit: 5.5, height: -0.5, angle: 1.05, speed: 0.068 },
  { name: 'NVR 存储',   img: '/images/products/nvr_recorder.png',   color: '#34d399', orbit: 5.5, height: 0.2,  angle: 2.09, speed: 0.072 },
  { name: '门禁面板',   img: '/images/products/access_control.png', color: '#10b981', orbit: 8.0, height: 1.2,  angle: 0.5,  speed: 0.050 },
  { name: 'PoE 交换机', img: '/images/products/network_switch.png', color: '#fbbf24', orbit: 8.0, height: -0.6, angle: 2.6,  speed: 0.046 },
  { name: '拼接屏',     img: '/images/products/video_wall.png',     color: '#38bdf8', orbit: 8.0, height: 0.5,  angle: 4.7,  speed: 0.054 },
  { name: '对讲终端',   img: '/images/products/intercom.png',       color: '#a78bfa', orbit: 5.5, height: -0.2, angle: 3.14, speed: 0.070 },
];

/** 产品广告牌 — 真实渲染图 + 全息光环底座 (复刻自 Login3) */
function ProductBillboard({ img, color, orbit, height, angle, speed }: typeof PRODUCTS[number]) {
  const texture = useLoader(THREE.TextureLoader, img);
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const centerX = 0, centerZ = 0;

  useMemo(() => {
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
  }, [texture]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      const a = angle + t * speed;
      groupRef.current.position.x = centerX + Math.cos(a) * orbit;
      groupRef.current.position.z = centerZ + Math.sin(a) * orbit;
      groupRef.current.position.y = height + Math.sin(t * 0.3 + angle * 3) * 0.35;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.5;
    }
  });

  return (
    <group ref={groupRef}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        {/* 产品图片 — 径向渐隐消除方角 */}
        <mesh position={[0, 0.25, 0]}>
          <planeGeometry args={[1.3, 1.3]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            uniforms={{
              uMap: { value: texture },
            }}
            vertexShader={`
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              uniform sampler2D uMap;
              varying vec2 vUv;
              void main() {
                vec4 tex = texture2D(uMap, vUv);
                float dist = length(vUv - 0.5) * 2.0;
                float mask = 1.0 - smoothstep(0.55, 1.0, dist);
                gl_FragColor = vec4(tex.rgb * mask, tex.a * mask);
              }
            `}
          />
        </mesh>

      </Billboard>

      {/* 底部全息光环 */}
      <mesh ref={ringRef} position={[0, -0.5, 0]} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[0.6, 0.014, 12, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, -0.5, 0]} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[0.38, 0.008, 8, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>
      <mesh position={[0, -0.5, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.6, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.05} side={THREE.DoubleSide} />
      </mesh>

      {/* 下方光柱 */}
      <mesh position={[0, -1.8, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 2.2, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} />
      </mesh>

      {/* 点光源 */}
      <pointLight color={color} intensity={1.2} distance={4} decay={2} position={[0, 0.25, 1]} />
    </group>
  );
}

/** 轨道引导环 — 半透明可视轨道 */
function OrbitRing({ radius, height = 0, color = '#22d3ee' }: {
  radius: number; height?: number; color?: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.getElapsedTime() * 0.015;
  });
  return (
    <mesh ref={ref} position={[0, height, 0]} rotation-x={Math.PI / 2}>
      <torusGeometry args={[radius, 0.008, 8, 120]} />
      <meshBasicMaterial color={color} transparent opacity={0.1} />
    </mesh>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────
   中心数据核心
   ──────────────────────────────────────────────────────────────────────────────── */

/** 中心数据核心 — 嵌套旋转多面体 + 发光球体 */
function DataCore() {
  const outerRef = useRef<THREE.Mesh>(null);
  const midRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (outerRef.current) {
      outerRef.current.rotation.x = t * 0.08;
      outerRef.current.rotation.y = t * 0.12;
    }
    if (midRef.current) {
      midRef.current.rotation.x = -t * 0.15;
      midRef.current.rotation.z = t * 0.1;
    }
    if (innerRef.current) {
      const s = 1 + Math.sin(t * 2) * 0.06;
      innerRef.current.scale.setScalar(s);
    }
  });

  return (
    <group position={[0, -1.2, -3.5]}>
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[1.1, 1]} />
        <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.05} />
      </mesh>
      <mesh ref={midRef}>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshBasicMaterial color="#60a5fa" wireframe transparent opacity={0.1} />
      </mesh>
      <mesh ref={innerRef}>
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshStandardMaterial
          color="#22d3ee" emissive="#22d3ee"
          emissiveIntensity={2.5} toneMapped={false}
        />
      </mesh>
      <pointLight color="#22d3ee" intensity={2.5} distance={14} decay={2} />
    </group>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────
   中央 Uniview 品牌平台
   ──────────────────────────────────────────────────────────────────────────────── */

/** 发光平台 — 着色器脉冲 + 旋转光环 + 3D 品牌文字 */
function UniviewBrand({ revealed }: { revealed: boolean }) {
  const platformRef = useRef<THREE.ShaderMaterial>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);
  const textGroupRef = useRef<THREE.Group>(null);

  const targetIntensity = useRef(1);

  useEffect(() => {
    targetIntensity.current = revealed ? 2.2 : 1;
  }, [revealed]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#22d3ee') },
    uIntensity: { value: 1 },
  }), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (platformRef.current) {
      platformRef.current.uniforms.uTime.value = t;
      // 平滑过渡亮度
      const curr = platformRef.current.uniforms.uIntensity.value;
      platformRef.current.uniforms.uIntensity.value +=
        (targetIntensity.current - curr) * 0.03;
    }
    if (ring1Ref.current) ring1Ref.current.rotation.z = t * 0.18;
    if (ring2Ref.current) ring2Ref.current.rotation.z = -t * 0.14;
    if (ring3Ref.current) ring3Ref.current.rotation.z = t * 0.1;

    // 文字轻微浮动
    if (textGroupRef.current) {
      textGroupRef.current.position.y = 0.5 + Math.sin(t * 0.6) * 0.12;
    }
  });

  return (
    <group position={[0, -0.3, 0]}>
      {/* ─ 发光平台 ─ */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
        <circleGeometry args={[4.5, 64]} />
        <shaderMaterial
          ref={platformRef}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          uniforms={uniforms}
          vertexShader={/* glsl */ `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={/* glsl */ `
            varying vec2 vUv;
            uniform float uTime;
            uniform vec3 uColor;
            uniform float uIntensity;

            void main() {
              float dist = length(vUv - 0.5) * 2.0;

              // 边缘辉光
              float edge = smoothstep(0.92, 1.0, dist);
              float edgeGlow = edge * (0.6 + sin(uTime * 2.5) * 0.2);

              // 扩散脉冲
              float pulse = sin(dist * 6.0 - uTime * 1.8) * 0.5 + 0.5;
              pulse *= smoothstep(1.0, 0.15, dist) * 0.25;

              // 径向渐变
              float grad = smoothstep(1.0, 0.0, dist) * 0.12;

              // 十字能量线
              float cross1 = smoothstep(0.02, 0.0, abs(vUv.x - 0.5)) * smoothstep(1.0, 0.3, dist) * 0.15;
              float cross2 = smoothstep(0.02, 0.0, abs(vUv.y - 0.5)) * smoothstep(1.0, 0.3, dist) * 0.15;

              float alpha = (edgeGlow + pulse + grad + cross1 + cross2) * uIntensity;
              vec3 col = uColor * (edgeGlow + pulse + cross1 + cross2);
              gl_FragColor = vec4(col, alpha * 0.7);
            }
          `}
        />
      </mesh>

      {/* ─ 旋转光环层 ─ */}
      <mesh ref={ring1Ref} rotation-x={Math.PI / 2} position={[0, 0.06, 0]}>
        <torusGeometry args={[2.8, 0.012, 8, 80]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.3} />
      </mesh>
      <mesh ref={ring2Ref} rotation-x={Math.PI / 2} position={[0, 0.12, 0]}>
        <torusGeometry args={[3.5, 0.01, 8, 80]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.22} />
      </mesh>
      <mesh ref={ring3Ref} rotation-x={Math.PI / 2} position={[0, 0.18, 0]}>
        <torusGeometry args={[4.2, 0.008, 8, 80]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.15} />
      </mesh>

      {/* ─ 垂直光柱 ─ */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.04, 0.6, 5, 8, 1, true]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.04}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* ─ 平台点光源 ─ */}
      <pointLight position={[0, 1.5, 0]} color="#22d3ee" intensity={4} distance={12} decay={2} />

      {/* ─ 3D 品牌文字（Html 在 3D 空间中定位） ─ */}
      <group ref={textGroupRef} position={[0, 0.5, 0]}>
        <Html
          center
          transform
          occlude={false}
          pointerEvents="none"
          style={{
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
          zIndexRange={[1, 0]}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span style={{
              fontFamily: "'Inter', 'Helvetica Neue', 'PingFang SC', sans-serif",
              fontSize: '52px',
              fontWeight: 800,
              letterSpacing: '0.18em',
              background: 'linear-gradient(135deg, #fff 0%, #22d3ee 40%, #60a5fa 70%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: 'none',
              filter: 'drop-shadow(0 0 24px rgba(34,211,238,0.5)) drop-shadow(0 0 48px rgba(96,165,250,0.25))',
            }}>
              uniview
            </span>
            <span style={{
              fontFamily: "'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif",
              fontSize: '14px',
              fontWeight: 500,
              letterSpacing: '0.35em',
              color: 'rgba(96,165,250,0.7)',
              textShadow: '0 0 12px rgba(96,165,250,0.3)',
            }}>
              浙江宇视科技有限公司
            </span>
          </div>
        </Html>
      </group>
    </group>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────
   垂直数据流 + 鼠标光源
   ──────────────────────────────────────────────────────────────────────────────── */

/** 垂直数据流 — 向上流动的青色粒子柱 */
function DataStreams() {
  const pointsRef = useRef<THREE.Points>(null);
  const total = STREAM_COUNT * PARTICLES_PER_STREAM;

  const { positions, colors, speeds } = useMemo(() => {
    const pos = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    const spd = new Float32Array(total);
    const tmpColor = new THREE.Color();

    for (let s = 0; s < STREAM_COUNT; s++) {
      const sAngle = (s / STREAM_COUNT) * Math.PI * 2;
      const sR = 5.5 + Math.sin(s * 1.3) * 2;
      for (let p = 0; p < PARTICLES_PER_STREAM; p++) {
        const idx = s * PARTICLES_PER_STREAM + p;
        const i3 = idx * 3;
        const radOff = (Math.random() - 0.5) * 0.5;
        pos[i3] = Math.cos(sAngle) * (sR + radOff);
        pos[i3 + 1] = -6 + (p / PARTICLES_PER_STREAM) * 12;
        pos[i3 + 2] = Math.sin(sAngle) * (sR + radOff);

        const height = p / PARTICLES_PER_STREAM;
        tmpColor.setHSL(0.5 + height * 0.12, 0.85, 0.45 + height * 0.25);
        col[i3] = tmpColor.r;
        col[i3 + 1] = tmpColor.g;
        col[i3 + 2] = tmpColor.b;

        spd[idx] = 0.2 + Math.random() * 0.35;
      }
    }
    return { positions: pos, colors: col, speeds: spd };
  }, []);

  useFrame(({ clock }) => {
    const pts = pointsRef.current;
    if (!pts) return;
    const posAttr = pts.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = pts.geometry.attributes.color as THREE.BufferAttribute;
    const t = clock.getElapsedTime();
    const tmpColor = new THREE.Color();

    for (let i = 0; i < total; i++) {
      let y = posAttr.getY(i) + speeds[i] * 0.014;
      if (y > 6) y = -6;
      posAttr.setY(i, y);
      const hNorm = (y + 6) / 12;
      tmpColor.setHSL(0.48 + hNorm * 0.16, 0.85, 0.35 + hNorm * 0.35);
      colAttr.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    pts.rotation.y = t * 0.015;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={total} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={total} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.055} vertexColors transparent opacity={0.65}
        sizeAttenuation depthWrite={false}
      />
    </points>
  );
}

/** 鼠标跟踪光源 */
function MouseLight() {
  const lightRef = useRef<THREE.PointLight>(null);
  const target = useRef(new THREE.Vector3(0, 2, 5));

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      target.current.set(
        (e.clientX / window.innerWidth - 0.5) * 18,
        -(e.clientY / window.innerHeight - 0.5) * 12,
        5,
      );
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame(() => {
    if (lightRef.current) lightRef.current.position.lerp(target.current, 0.04);
  });

  return <pointLight ref={lightRef} color="#818cf8" intensity={2} distance={22} decay={2} />;
}

/* ────────────────────────────────────────────────────────────────────────────────
   场景合成
   ──────────────────────────────────────────────────────────────────────────────── */

function Scene({ revealed }: { revealed: boolean }) {
  return (
    <>
      <HoloGrid />
      <Stars radius={80} depth={60} count={1200} factor={3} saturation={0.1} fade speed={0.3} />
      <ambientLight intensity={0.12} color="#4488ff" />
      <DataCore />
      <UniviewBrand revealed={revealed} />
      <OrbitRing radius={5.5} height={0} color="#22d3ee" />
      <OrbitRing radius={8.0} height={0} color="#60a5fa" />
      {PRODUCTS.map(p => <ProductBillboard key={p.name} {...p} />)}
      <DataStreams />
      <MouseLight />
      <fog attach="fog" args={['#020810', 12, 55]} />
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════
   Login2Page — 宇视科技全息指挥中心登录页
   ════════════════════════════════════════════════════════════════════════════════ */
export default function Login2Page() {
  const [revealed, setRevealed] = useState(false);
  const { form, errorMsg, rememberMe, setRememberMe, isPending, handleSubmit, fillAndLogin } = useLoginForm();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020810] text-slate-100 selection:bg-cyan-300/30">

      {/* ━━ Layer 1: Three.js 3D 场景 ━━ */}
      <div className="fixed inset-0">
        <Canvas
          camera={{ position: [0, 2.5, 14], fov: 55 }}
          gl={{ antialias: true, alpha: false }}
          dpr={[1, 1.5]}
          style={{ background: '#020810' }}
          onPointerMissed={() => { if (!revealed) setRevealed(true); }}
        >
          <Scene revealed={revealed} />
        </Canvas>
      </div>

      {/* ━━ Layer 2: 扫描线覆层 ━━ */}
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        aria-hidden
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(59,130,246,0.012) 2px, rgba(59,130,246,0.012) 4px)',
        }}
      />

      {/* ━━ Layer 3: 侧边 HUD 装饰 ━━ */}
      <HUDOverlay />

      {/* ━━ Layer 3.5: 透明点击覆层 — 点击空白区域触发 reveal ━━ */}
      <div
        className="fixed inset-0 z-[3] cursor-pointer"
        style={{ pointerEvents: revealed ? 'none' : 'auto' }}
        onClick={() => setRevealed(true)}
      />

      {/* ━━ Layer 4: 登录卡片（可下滑隐藏） ━━ */}
      <div
        className="pointer-events-none relative z-10 flex min-h-screen items-center justify-center px-4 py-8"
        style={{
          transform: revealed ? 'translateY(110vh)' : 'translateY(0)',
          opacity: revealed ? 0 : 1,
          transition: 'transform 0.85s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease',
        }}
      >
        <div className="pointer-events-auto w-full max-w-[440px]">
          <div className="login-card relative overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#0a1628]/75 p-7 shadow-[0_32px_90px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.06] backdrop-blur-3xl sm:p-8">

            {/* 顶部光线 */}
            <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

            {/* Logo + 标题 */}
            <header className="mb-7 text-center">
              <div className="relative mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center">
                <div className="absolute inset-0 animate-spin rounded-full border border-dashed border-cyan-400/25 [animation-duration:10s]" />
                <div className="absolute inset-[-4px] animate-spin rounded-full border border-dotted border-blue-400/15 [animation-duration:16s] [animation-direction:reverse]" />
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 shadow-lg shadow-cyan-500/15">
                  <Shield className="h-7 w-7 text-cyan-300" />
                </div>
              </div>
              <h1 className="bg-gradient-to-r from-white via-cyan-100 to-blue-200 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                UNIVIEW 固定资产
              </h1>
              <p className="mt-1.5 text-[13px] text-slate-400">
                固定资产全息指挥中心
              </p>
              <div className="mx-auto mt-2 flex w-fit items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-500/5 px-2.5 py-0.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[10px] font-medium text-emerald-300/80">SYSTEM ONLINE</span>
              </div>
            </header>

            {/* 提示文字 */}
            <p className="mb-3 text-center text-[11px] text-cyan-400/40">
              点击背景可查看全景展示
            </p>

            {/* 表单 */}
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

          <div className="mt-6 text-center">
            <a href="/login" className="text-sm text-slate-500 transition-colors hover:text-cyan-300">
              切换到标准登录页
            </a>
          </div>

          <footer className="mt-4 text-center text-xs text-slate-700">
            <p>&copy; 2026 浙江宇视科技有限公司</p>
          </footer>
        </div>
      </div>

      {/* ━━ 关闭全景按钮（仅在 revealed 时可见） ━━ */}
      <button
        onClick={() => setRevealed(false)}
        className="fixed right-6 top-6 z-[15] flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-[#0a1628]/80 px-4 py-2.5 text-sm text-cyan-200/70 backdrop-blur-md transition-all duration-500 hover:border-cyan-400/40 hover:bg-[#0a1628]/95 hover:text-white"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(-20px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
          pointerEvents: revealed ? 'auto' : 'none',
        }}
      >
        <Shield className="h-4 w-4" />
        返回登录
      </button>

      {/* ━━ 全息卡片动画 ━━ */}
      <style>{`
        .login-card::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 29px;
          padding: 1px;
          background: linear-gradient(
            135deg,
            transparent 25%,
            rgba(34,211,238,0.2) 40%,
            rgba(96,165,250,0.2) 55%,
            transparent 75%
          );
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: border-shimmer 4s ease-in-out infinite;
          pointer-events: none;
          z-index: 0;
        }

        .login-card > * {
          position: relative;
          z-index: 1;
        }

        @keyframes border-shimmer {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.001); }
        }

        @keyframes data-flow {
          0% { background-position: 0 0; }
          100% { background-position: 0 -200px; }
        }

        @keyframes float-y {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </main>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════
   HUD Overlay — 侧边数据流 + 四角装饰 + 状态指示器
   ════════════════════════════════════════════════════════════════════════════════ */
function HUDOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[2]" aria-hidden>

      {/* ── 左侧数据流 ── */}
      <div className="absolute left-3 top-1/4 hidden h-1/2 flex-col items-center gap-2 md:flex">
        {[...Array(12)].map((_, i) => (
          <div key={i}
            className="h-2.5 w-[3px] rounded-full bg-gradient-to-b from-cyan-400/50 to-transparent"
            style={{ animation: `data-flow 1.2s linear infinite`, animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>

      {/* ── 右侧数据流 ── */}
      <div className="absolute right-3 top-1/3 hidden h-1/3 flex-col items-center gap-2 md:flex">
        {[...Array(8)].map((_, i) => (
          <div key={i}
            className="h-2.5 w-[3px] rounded-full bg-gradient-to-b from-blue-400/40 to-transparent"
            style={{ animation: `data-flow 1.5s linear infinite`, animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>

      {/* ── 左上角 HUD ── */}
      <div className="absolute left-5 top-5 hidden md:block">
        <div className="h-6 w-6 border-l-2 border-t-2 border-cyan-400/25 rounded-tl-sm" />
        <p className="mt-2 font-mono text-[10px] tracking-[0.15em] text-cyan-400/40">
          浙江宇视科技有限公司
        </p>
      </div>

      {/* ── 右上角 HUD ── */}
      <div className="absolute right-5 top-5 hidden md:block">
        <div className="ml-auto h-6 w-6 border-r-2 border-t-2 border-cyan-400/25 rounded-tr-sm" />
        <p className="mt-2 text-right font-mono text-[10px] tracking-[0.2em] text-cyan-400/35">
          SECURE CHANNEL
        </p>
      </div>

      {/* ── 左下角 HUD ── */}
      <div className="absolute bottom-5 left-5 hidden md:block">
        <div className="h-6 w-6 border-b-2 border-l-2 border-cyan-400/25 rounded-bl-sm" />
      </div>

      {/* ── 右下角 HUD ── */}
      <div className="absolute bottom-5 right-5 hidden text-right md:block">
        <div className="ml-auto h-6 w-6 border-b-2 border-r-2 border-cyan-400/25 rounded-br-sm" />
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <Activity className="h-3 w-3 text-cyan-400/30" />
          <span className="font-mono text-[9px] tracking-widest text-cyan-400/30">LINK ACTIVE</span>
        </div>
      </div>

      {/* ── 底部中央微型波形 ── */}
      <div className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 items-center gap-[3px] md:flex">
        {[...Array(20)].map((_, i) => (
          <div key={i}
            className="w-[2px] rounded-full bg-cyan-400/20"
            style={{
              height: `${3 + Math.sin(i * 0.5) * 4 + Math.cos(i * 0.8) * 2}px`,
              animation: `float-y ${1.5 + i * 0.1}s ease-in-out infinite`,
              animationDelay: `${i * 0.05}s`,
            }} />
        ))}
      </div>
    </div>
  );
}
