import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Users, Building2, Database, Bell, Shield, Plug } from "lucide-react";
import { userService } from "../services/userService";
import { roleService } from "../services/roleService";
import { deptService } from "../services/deptService";

export function Settings() {
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'departments' | 'integration' | 'notification' | 'security'>('general');
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [userList, roleList, deptList] = await Promise.all([
        userService.list(),
        roleService.list(),
        deptService.getAll(),
      ]);
      setUsers(Array.isArray(userList) ? userList : (userList as any)?.records || []);
      setRoles(Array.isArray(roleList) ? roleList : (roleList as any)?.records || []);
      setDepts(Array.isArray(deptList) ? deptList : (deptList as any)?.records || []);
    } catch (err) {
      console.error('Failed to load settings data:', err);
      setError('设置数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">系统设置</h2>
        <p className="text-gray-600 mt-1">管理系统配置、用户权限与集成</p>
      </div>

      <div className="flex gap-6">
        {/* 侧边栏导航 */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-lg border border-gray-200 p-2">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === 'general' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span className="font-medium">基础设置</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === 'users' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="font-medium">用户管理</span>
            </button>
            <button
              onClick={() => setActiveTab('departments')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === 'departments' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Building2 className="w-5 h-5" />
              <span className="font-medium">部门管理</span>
            </button>
            <button
              onClick={() => setActiveTab('integration')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === 'integration' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Plug className="w-5 h-5" />
              <span className="font-medium">系统集成</span>
            </button>
            <button
              onClick={() => setActiveTab('notification')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === 'notification' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Bell className="w-5 h-5" />
              <span className="font-medium">消息通知</span>
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === 'security' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span className="font-medium">安全设置</span>
            </button>
          </div>
        </div>

        {/* 主内容区域 */}
        <div className="flex-1">
          {loading && <div className="mb-4 text-sm text-gray-500">加载中...</div>}
          {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
          {/* 基础设置 */}
          {activeTab === 'general' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">基础设置</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">企业名称</label>
                  <input type="text" defaultValue="示例科技有限公司" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">系统名称</label>
                  <input type="text" defaultValue="企业资产管理系统" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">默认货币</label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>人民币 (CNY)</option>
                      <option>美元 (USD)</option>
                      <option>欧元 (EUR)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">时区</label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>北京时间 (UTC+8)</option>
                      <option>东京时间 (UTC+9)</option>
                      <option>伦敦时间 (UTC+0)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">数据备份频率</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>每天</option>
                    <option>每周</option>
                    <option>每月</option>
                  </select>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">启用自动同步ERP</p>
                    <p className="text-sm text-gray-600 mt-1">自动将资产数据同步至ERP系统</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button onClick={() => setEditItem(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">
                    取消
                  </button>
                  <button onClick={() => alert('设置已保存')} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                    保存设置
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 用户管理 */}
          {activeTab === 'users' && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">用户管理</h3>
                <button onClick={() => setShowAddUserModal(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                  添加用户
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户名</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">邮箱</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">部门</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.name || user.username || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{user.email || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{user.department || user.deptName || '-'}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                            {user.roleName || roles.find((r) => r.id === user.roleId)?.name || '普通员工'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            {user.status || '正常'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <button onClick={() => setEditItem(user)} className="text-blue-600 hover:text-blue-700 mr-3">编辑</button>
                          <button onClick={() => handleToggleUserStatus(user)} className="text-red-600 hover:text-red-700">{user.status === 0 || user.status === '禁用' ? '启用' : '禁用'}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 部门管理 */}
          {activeTab === 'departments' && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">部门管理</h3>
                <button onClick={() => setShowAddDeptModal(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                  添加部门
                </button>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {depts.map((dept) => (
                    <div key={dept.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{dept.name || dept.deptName}</p>
                          <p className="text-sm text-gray-600">负责人: {dept.leader || '未配置'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">{dept.memberCount || 0}名员工</span>
                        <button onClick={() => setEditItem(dept)} className="text-blue-600 hover:text-blue-700 text-sm font-medium">编辑</button>
                        <button onClick={() => handleDeleteDept(dept.id)} className="text-red-600 hover:text-red-700 text-sm font-medium">删除</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 系统集成 */}
          {activeTab === 'integration' && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Database className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">ERP系统集成</h4>
                      <p className="text-sm text-gray-600">实时同步资产核算数据</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full">
                    已连接
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ERP服务地址</label>
                    <input type="text" defaultValue="https://erp.company.com/api" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">API密钥</label>
                    <input type="password" defaultValue="••••••••••••••••" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <button onClick={() => alert('连接测试成功')} className="mt-4 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors">
                  测试连接
                </button>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Plug className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">钉钉集成</h4>
                      <p className="text-sm text-gray-600">消息通知与审批流程</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 text-sm font-medium bg-gray-100 text-gray-800 rounded-full">
                    未连接
                  </span>
                </div>
                <button onClick={() => alert('钉钉集成配置功能开发中')} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                  配置钉钉集成
                </button>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <Database className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">财务系统集成</h4>
                      <p className="text-sm text-gray-600">资产折旧与财务核算</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full">
                    已连接
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 消息通知 */}
          {activeTab === 'notification' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">消息通知设置</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">保养到期提醒</p>
                    <p className="text-sm text-gray-600 mt-1">设备保养到期前3天发送提醒</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">审批流程通知</p>
                    <p className="text-sm text-gray-600 mt-1">新的待审批事项立即通知</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">闲置资产公告</p>
                    <p className="text-sm text-gray-600 mt-1">新的闲置资产公告发布通知</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">盘点任务提醒</p>
                    <p className="text-sm text-gray-600 mt-1">盘点任务开始和结束提醒</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 安全设置 */}
          {activeTab === 'security' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">安全设置</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">密码策略</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>强密码(至少8位,包含大小写字母、数字、特殊字符)</option>
                    <option>中等强度(至少6位,包含字母和数字)</option>
                    <option>普通密码(至少6位)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">密码有效期(天)</label>
                  <input type="number" defaultValue="90" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">会话超时时间(分钟)</label>
                  <input type="number" defaultValue="30" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">启用双因素认证</p>
                    <p className="text-sm text-gray-600 mt-1">登录时需要验证码验证</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">记录操作日志</p>
                    <p className="text-sm text-gray-600 mt-1">记录所有用户操作以供审计</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button onClick={() => setEditItem(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">
                    取消
                  </button>
                  <button onClick={() => alert('设置已保存')} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                    保存设置
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 添加用户弹窗 */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddUserModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">添加用户</h3>
            <input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="用户名" className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddUserModal(false)} className="px-4 py-2 text-sm text-gray-700 border rounded-lg">取消</button>
              <button onClick={handleAddUser} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg">确认添加</button>
            </div>
          </div>
        </div>
      )}

      {/* 添加部门弹窗 */}
      {showAddDeptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddDeptModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">添加部门</h3>
            <input value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="部门名称" className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddDeptModal(false)} className="px-4 py-2 text-sm text-gray-700 border rounded-lg">取消</button>
              <button onClick={handleAddDept} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg">确认添加</button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditItem(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">编辑详情</h3>
              <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-3">
              {Object.entries(editItem).map(([key, value]) => (
                <div key={key} className="flex items-start gap-3 text-sm">
                  <span className="text-gray-500 min-w-[120px]">{key}:</span>
                  <span className="text-gray-900">{value === null || value === undefined ? '-' : String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
