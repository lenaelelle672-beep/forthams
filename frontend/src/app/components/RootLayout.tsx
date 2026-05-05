import { Outlet, NavLink, useNavigate } from "react-router";
import { 
  LayoutDashboard, 
  Package, 
  Wrench, 
  Radio, 
  Archive, 
  DollarSign, 
  ClipboardCheck, 
  Workflow,
  BarChart3, 
  Settings as SettingsIcon,
  Bell,
  User,
  Search,
  LogOut,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";

const navigation = [
  { name: '仪表板', href: '/', icon: LayoutDashboard },
  { name: '资产台账', href: '/assets', icon: Package },
  { name: '重要设备', href: '/equipment', icon: Wrench },
  { name: 'RFID盘点', href: '/inventory', icon: Radio },
  { name: '闲置资产', href: '/idle', icon: Archive },
  { name: '资产处置', href: '/disposals', icon: DollarSign },
  { name: '审批流程', href: '/approval', icon: ClipboardCheck },
  { name: '流程管理', href: '/workflows', icon: Workflow },
  { name: '数据分析', href: '/analytics', icon: BarChart3 },
  { name: '系统设置', href: '/settings', icon: SettingsIcon },
];

export function RootLayout() {
  const [notifications] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [headerMessage, setHeaderMessage] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleGlobalSearch = (event: FormEvent) => {
    event.preventDefault();
    const keyword = searchQuery.trim();
    if (!keyword) {
      setHeaderMessage('请输入资产名称或编号后再搜索');
      return;
    }
    setHeaderMessage(`正在搜索“${keyword}”`);
    navigate(`/assets?keyword=${encodeURIComponent(keyword)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-10">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">企业资产管理系统</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <form className="relative" onSubmit={handleGlobalSearch}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="搜索资产..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </form>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowNotifications((prev) => !prev);
                  setHeaderMessage(null);
                }}
                className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="查看通知"
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {notifications > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-20">
                  <div className="font-medium text-gray-900 mb-2">通知</div>
                  <div className="text-sm text-gray-600">暂无新的待办通知，后续消息会在这里显示。</div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-sm">
                <div className="font-medium text-gray-900">{user?.realName ?? user?.username ?? "管理员"}</div>
                <div className="text-gray-500">{user?.username ?? "admin"}</div>
              </div>
              <Button className="h-8 px-3 text-gray-600" onClick={logout} size="sm" variant="ghost">
                <LogOut className="w-4 h-4" />
                退出
              </Button>
            </div>
          </div>
        </div>
      </header>

      {headerMessage && (
        <div className="fixed top-16 right-6 z-20 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700 shadow-sm">
          {headerMessage}
        </div>
      )}

      {/* 侧边栏 */}
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto">
        <nav className="p-4 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* 主内容区域 */}
      <main className="ml-64 mt-16 p-6">
        <Outlet />
      </main>
    </div>
  );
}
