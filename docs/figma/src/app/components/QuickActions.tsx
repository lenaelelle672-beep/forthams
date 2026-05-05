import { Plus, Upload, Download, Radio, Send, Wrench, ClipboardCheck } from "lucide-react";
import { useNavigate } from "react-router";

export function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { 
      icon: Plus, 
      label: '新增资产', 
      description: '快速添加新资产',
      color: 'blue',
      onClick: () => navigate('/assets')
    },
    { 
      icon: Radio, 
      label: 'RFID盘点', 
      description: '开始资产盘点',
      color: 'purple',
      onClick: () => navigate('/inventory')
    },
    { 
      icon: Wrench, 
      label: '设备保养', 
      description: '记录保养信息',
      color: 'green',
      onClick: () => navigate('/equipment')
    },
    { 
      icon: Send, 
      label: '闲置公告', 
      description: '发布闲置资产',
      color: 'yellow',
      onClick: () => navigate('/idle')
    },
    { 
      icon: ClipboardCheck, 
      label: '审批流程', 
      description: '查看待审批',
      color: 'red',
      onClick: () => navigate('/approval')
    },
    { 
      icon: Download, 
      label: '导出报表', 
      description: '下载数据报表',
      color: 'indigo',
      onClick: () => navigate('/analytics')
    },
  ];

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
    green: 'bg-green-50 text-green-600 hover:bg-green-100',
    yellow: 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100',
    red: 'bg-red-50 text-red-600 hover:bg-red-100',
    indigo: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">快捷操作</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="flex flex-col items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-all group"
          >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${colorClasses[action.color as keyof typeof colorClasses]}`}>
              <action.icon className="w-6 h-6" />
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                {action.label}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {action.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
