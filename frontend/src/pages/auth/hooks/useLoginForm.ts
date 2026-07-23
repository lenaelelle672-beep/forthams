/**
 * @file pages/auth/hooks/useLoginForm.ts
 * @description Shared login form logic: react-hook-form, zod validation, login mutation, remember-me.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { loginSchema, type LoginFormValues } from '../loginConfig';

export function useLoginForm() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { login } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  // Surface a session-expired notice when redirected here by the http 401
  // interceptor (?expired=1). Consume the param so it does not persist across
  // subsequent login attempts.
  useEffect(() => {
    if (searchParams.get('expired') === '1') {
      setErrorMsg('您的会话已过期，请重新登录');
      searchParams.delete('expired');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Restore remembered username
  useEffect(() => {
    const saved = localStorage.getItem('remembered_username');
    if (saved) {
      form.setValue('username', saved);
      setRememberMe(true);
    }
  }, [form.setValue]);

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormValues) => {
      await login(data);
      return data;
    },
    onSuccess: ({ username }) => {
      if (rememberMe) {
        localStorage.setItem('remembered_username', username);
      } else {
        localStorage.removeItem('remembered_username');
      }
      navigate('/fixed-assets/workbench?menu=home', { replace: true });
    },
    onError: (err: any) => {
      const msg = err?.message || '网络错误，请检查网络后重试';
      toast.error(msg);
      setErrorMsg(msg);
    },
  });

  const onSubmit = useCallback(
    (data: LoginFormValues) => {
      setErrorMsg(null);
      loginMutation.mutate(data);
    },
    [loginMutation.mutate],
  );

  const fillAndLogin = useCallback(
    (username: string, password: string) => {
      form.setValue('username', username);
      form.setValue('password', password);
      setErrorMsg(null);
      setTimeout(() => loginMutation.mutate({ username, password }), 200);
    },
    [form.setValue, loginMutation.mutate],
  );

  return {
    form,
    errorMsg,
    rememberMe,
    setRememberMe,
    isPending: loginMutation.isPending,
    handleSubmit: form.handleSubmit(onSubmit),
    fillAndLogin,
  };
}
