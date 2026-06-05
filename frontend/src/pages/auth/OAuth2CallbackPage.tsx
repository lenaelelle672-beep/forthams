import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { PageTransition, ErrorState, EmptyState } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from '@/utils/auth';

export default function OAuth2CallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const username = searchParams.get('username');
    const errorType = searchParams.get('error');

    if (errorType) {
      const errorMessages: Record<string, string> = {
        'oauth_user_not_found': '未找到对应的第三方用户',
        'oauth_user_not_bound': '第三方账号未绑定系统用户',
        'oauth_failed': '第三方登录失败',
      };
      setError(errorMessages[errorType] || '第三方登录失败');
      return;
    }

    if (!token || !username) {
      setError('Token 缺失，OAuth2 登录失败');
      return;
    }

    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify({
      userId: 0,
      username,
      realName: username,
      roles: [],
      permissions: [],
    }));

    navigate('/dashboard', { replace: true });
  }, [searchParams, navigate]);

  if (error) {
    return (
      <PageTransition>
        <ErrorBoundary>
        <div className="flex items-center justify-center min-h-screen bg-[#0b1326]">
          <div className="text-center">
            <ErrorState title="登录失败" description={error} onRetry={() => navigate('/login', { replace: true })} />
          </div>
        </div>
        </ErrorBoundary>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <ErrorBoundary>
      <div className="flex items-center justify-center min-h-screen bg-[#0b1326]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-3 border-blue-500 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-[#dae2fd]">第三方登录中…</p>
          <div className="mt-4">
            <EmptyState
              title="正在处理"
              description="OAuth2 回调处理中，请勿关闭页面"
              className="!bg-transparent !border-none !py-2 [&_h3]:!text-[#dae2fd] [&_p]:!text-[#8d90a0]"
            />
          </div>
        </div>
      </div>
      </ErrorBoundary>
    </PageTransition>
  );
}
