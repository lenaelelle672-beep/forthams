import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from '@/app/utils/api';

export default function SsoCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const userId = searchParams.get('userId');
    const username = searchParams.get('username');
    const realName = searchParams.get('realName') || '';
    const rolesStr = searchParams.get('roles') || '';

    if (!token || !username) {
      setError('Token 缺失，SSO 登录失败');
      return;
    }

    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify({
      userId: Number(userId),
      username,
      realName,
      roles: rolesStr ? rolesStr.split(',').filter(Boolean) : [],
      permissions: [],
    }));

    navigate('/dashboard', { replace: true });
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0b1326]">
        <div className="text-center">
          <p className="text-white text-lg mb-4">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg"
          >
            返回登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0b1326]">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-3 border-blue-500 border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-[#dae2fd]">SSO 登录中…</p>
      </div>
    </div>
  );
}
