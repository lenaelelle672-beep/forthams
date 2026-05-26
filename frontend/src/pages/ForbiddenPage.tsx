import { ShieldX, ArrowLeft, Home, LogOut } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { clearAuthStorage } from '@/app/utils/api';

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason');

  // roles_missing 场景：用户信息不完整，引导重新登录
  if (reason === 'roles_missing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-amber-50 flex items-center justify-center mb-6">
            <ShieldX className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">用户信息不完整</h1>
          <p className="text-gray-500 mb-2">
            当前用户角色信息缺失，无法验证访问权限。
          </p>
          <p className="text-sm text-gray-400 mb-8">
            请重新登录后重试，如问题持续请联系管理员。
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                clearAuthStorage();
                navigate('/login', { replace: true });
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              重新登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mb-6">
          <ShieldX className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">无访问权限</h1>
        <p className="text-gray-500 mb-2">
          您没有访问此页面的权限。
        </p>
        <p className="text-sm text-gray-400 mb-8">
          请联系管理员获取相应角色权限后再尝试访问。
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回上一页
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Home className="w-4 h-4" />
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
