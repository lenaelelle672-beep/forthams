/**
 * @file pages/auth/components/LoginFormFields.tsx
 * @description Reusable login form fields: username, password, remember-me, error message, submit button.
 */

import { useState } from 'react';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import type { UseFormReturn } from 'react-hook-form';
import type { LoginFormValues } from '../loginConfig';

interface Props {
  form: UseFormReturn<LoginFormValues>;
  errorMsg: string | null;
  rememberMe: boolean;
  onRememberChange: (checked: boolean) => void;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function LoginFormFields({
  form,
  errorMsg,
  rememberMe,
  onRememberChange,
  isPending,
  onSubmit,
}: Props) {
  const { register, formState: { errors } } = form;
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {/* Username */}
      <div className="space-y-1.5">
        <label
          className="ml-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400"
          htmlFor="username"
        >
          用户名
        </label>
        <div className="group relative flex items-center rounded-xl border border-white/[0.08] bg-[#0d1b30]/80 transition-all duration-200 hover:border-white/[0.15] focus-within:border-blue-400/50 focus-within:ring-2 focus-within:ring-blue-400/10">
          <User className="absolute left-4 h-[18px] w-[18px] text-slate-500 transition-colors group-focus-within:text-blue-300" />
          <input
            {...register('username')}
            id="username"
            type="text"
            autoComplete="username"
            placeholder="请输入账号"
            className="w-full border-none bg-transparent py-3 pl-12 pr-4 text-[15px] text-slate-100 outline-none placeholder:text-slate-600"
          />
        </div>
        {errors.username && (
          <p className="ml-1 text-xs text-red-400/90">{errors.username.message}</p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label
          className="ml-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400"
          htmlFor="password"
        >
          密码
        </label>
        <div className="group relative flex items-center rounded-xl border border-white/[0.08] bg-[#0d1b30]/80 transition-all duration-200 hover:border-white/[0.15] focus-within:border-blue-400/50 focus-within:ring-2 focus-within:ring-blue-400/10">
          <Lock className="absolute left-4 h-[18px] w-[18px] text-slate-500 transition-colors group-focus-within:text-blue-300" />
          <input
            {...register('password')}
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="请输入密码"
            className="w-full border-none bg-transparent py-3 pl-12 pr-12 text-[15px] text-slate-100 outline-none placeholder:text-slate-600"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-4 text-slate-500 transition-colors hover:text-slate-200"
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
          >
            {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        </div>
        {errors.password && (
          <p className="ml-1 text-xs text-red-400/90">{errors.password.message}</p>
        )}
      </div>

      {/* Remember me + Forgot password */}
      <div className="flex items-center justify-between pt-0.5">
        <label className="group flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => onRememberChange(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-[#1b2a44] text-blue-500 focus:ring-blue-400/50 focus:ring-offset-transparent"
          />
          <span className="text-[13px] text-slate-400 transition-colors group-hover:text-slate-200">
            记住用户名
          </span>
        </label>
        <button
          type="button"
          className="text-[13px] text-blue-300/70 transition-colors hover:text-blue-200"
          onClick={() => toast.info('请联系管理员重置密码')}
        >
          忘记密码?
        </button>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-2.5 text-center text-[13px] text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={isPending}
        className="!h-11 w-full !rounded-xl !bg-gradient-to-r !from-blue-600 !to-blue-500 !text-[15px] !font-semibold !shadow-lg !shadow-blue-600/20 transition-all hover:!shadow-blue-500/30 active:!scale-[0.98]"
      >
        登录系统
      </Button>
    </form>
  );
}
