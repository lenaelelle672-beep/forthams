import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Center, Html, MeshReflectorMaterial, OrbitControls, Trail, useTexture } from '@react-three/drei';
import { geoMercator } from 'd3-geo';
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
import sichuanData from '@/assets/sc-demo2.json';
import sichuanOutlineData from '@/assets/sc-outline-demo2.json';
import scTerrainMap from '@/assets/sc-map.webp';
import scReliefMap from '@/assets/sc-displacement-map.webp';
import scNormalMap from '@/assets/sc-normal-map1.webp';
import cityRingTexture from '@/assets/guangquan01.png';
import flyLineTexture from '@/assets/fly-line.png';
import bottomHaloTexture from '@/assets/quan1.png';

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

const sichuanGeoData = sichuanData as unknown as GeoCollection;
const sichuanOutlineGeoData = sichuanOutlineData as unknown as GeoCollection;


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

function MapIntro({ groupRef, onComplete }: { groupRef: RefObject<Group>; onComplete: () => void }) {
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


type BigScreen3DCanvasProps = {
  selectedCity: string | null;
  onSelectCity: (name: string) => void;
  onIntroComplete: () => void;
  onError: (message: string) => void;
};

export default function BigScreen3DCanvas({ selectedCity, onSelectCity, onIntroComplete, onError }: BigScreen3DCanvasProps) {
  return (
    <Canvas
      camera={{ fov: 70, position: [3, 20, 10] }}
      dpr={[1, 1.5]}
      gl={{ alpha: false, antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => gl.setClearColor('#000000', 1)}
      onError={(event) => onError(event.message || 'WebGL 渲染初始化失败')}
    >
      <SichuanMapScene selectedCity={selectedCity} onSelectCity={onSelectCity} onIntroComplete={onIntroComplete} />
    </Canvas>
  );
}
