// Fix: react-router-dom types
declare module 'react-router-dom' {
  import * as RRD from 'react-router-dom';
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
