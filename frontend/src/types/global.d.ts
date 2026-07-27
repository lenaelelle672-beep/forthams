// Fix: react-router-dom types
declare module 'react-router-dom' {
  import * as RRD from 'react-router';
  export const useParams: typeof RRD.useParams;
  export const useNavigate: typeof RRD.useNavigate;
  export const useLocation: typeof RRD.useLocation;
  export const Link: typeof RRD.Link;
  export const Navigate: typeof RRD.Navigate;
  export const Outlet: typeof RRD.Outlet;
  export const BrowserRouter: typeof RRD.BrowserRouter;
  export const Routes: typeof RRD.Routes;
  export const Route: typeof RRD.Route;
}

// Fix: inventory locale t function (actual file has export default t; this adds named export)
declare module '../../locales/zh-CN/inventory' {
  export function t(key: string, params?: Record<string, unknown>): string;
}

// Fix: react-three-fiber JSX intrinsic elements (mesh, group, points, etc.)
// These are provided by @react-three/fiber at runtime but tsc doesn't see them
// without the ThreeElements namespace augmentation.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      group: any;
      points: any;
      pointLight: any;
      ambientLight: any;
      directionalLight: any;
      meshBasicMaterial: any;
      meshStandardMaterial: any;
      shaderMaterial: any;
      planeGeometry: any;
      boxGeometry: any;
      sphereGeometry: any;
      bufferGeometry: any;
      bufferAttribute: any;
      cylinderGeometry: any;
      ringGeometry: any;
      circleGeometry: any;
      lineSegments: any;
      lineBasicMaterial: any;
      orthographicCamera: any;
      perspectiveCamera: any;
      fog: any;
      color: any;
      primitive: any;
    }
  }
}
