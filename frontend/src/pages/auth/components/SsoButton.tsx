/**
 * @file pages/auth/components/SsoButton.tsx
 * @description MaxKey SSO login button.
 */

import { LogIn } from 'lucide-react';

export default function SsoButton() {
  const href = `${import.meta.env.VITE_API_BASE || ''}/api/oauth2/authorization/maxkey`;

  return (
    <div className="mt-5 border-t border-white/[0.06] pt-5">
      <a
        href={href}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] py-2.5 text-[13px] font-medium text-slate-300 transition-all hover:-translate-y-px hover:border-blue-400/20 hover:bg-white/[0.06]"
      >
        <LogIn className="h-4 w-4" />
        MaxKey 单点登录
      </a>
      <p className="mt-2 text-center text-[11px] text-slate-600">使用组织统一身份认证登录</p>
    </div>
  );
}
