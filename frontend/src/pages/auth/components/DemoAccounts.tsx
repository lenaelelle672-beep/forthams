/**
 * @file pages/auth/components/DemoAccounts.tsx
 * @description Quick-access demo account buttons for dev/staging environments.
 */

import { DEMO_ACCOUNTS } from '../loginConfig';

interface Props {
  onFillAndLogin: (username: string, password: string) => void;
  isPending: boolean;
}

export default function DemoAccounts({ onFillAndLogin, isPending }: Props) {
  if (DEMO_ACCOUNTS.length === 0) return null;

  return (
    <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        演示账户
      </p>
      <div className="grid grid-cols-2 gap-2">
        {DEMO_ACCOUNTS.map(({ label, desc, username, password, Icon }) => (
          <button
            key={username}
            type="button"
            onClick={() => onFillAndLogin(username, password)}
            disabled={isPending}
            className="rounded-lg border border-white/[0.06] bg-[#0a1628]/60 px-3 py-2 text-left transition-all hover:-translate-y-px hover:border-white/[0.12] hover:bg-white/[0.05] disabled:opacity-30"
          >
            <div className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-blue-400/60" />
              <span className="text-xs font-medium text-slate-300">{label}</span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-600">{desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
