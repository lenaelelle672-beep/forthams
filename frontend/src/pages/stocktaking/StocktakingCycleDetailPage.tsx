import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  Play,
  Pause,
  Check,
  X,
  List,
  AlertCircle,
} from 'lucide-react';

export default function StocktakingCycleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cycleRes, tasksRes, statsRes] = await Promise.all([
        fetch(`/api/stocktaking/cycles/${id}`),
        fetch(`/api/stocktaking/cycles/${id}/tasks`),
        fetch(`/api/stocktaking/cycles/${id}/stats`),
      ]);

      const cycleData = await cycleRes.json();
      const tasksData = await tasksRes.json();
      const statsData = await statsRes.json();

      setCycle(cycleData.data);
      setTasks(tasksData.data || []);
      setStats(statsData.data);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTasks = async () => {
    if (!confirm('确认分配盘点任务？')) return;

    try {
      await fetch(`/api/stocktaking/cycles/${id}/assign`, { method: 'POST' });
      fetchData();
    } catch (error) {
      console.error('分配任务失败:', error);
      alert('分配任务失败，请重试');
    }
  };

  const handlePause = async () => {
    try {
      await fetch(`/api/stocktaking/cycles/${id}/pause`, { method: 'POST' });
      fetchData();
    } catch (error) {
      console.error('暂停失败:', error);
    }
  };

  const handleResume = async () => {
    try {
      await fetch(`/api/stocktaking/cycles/${id}/resume`, { method: 'POST' });
      fetchData();
    } catch (error) {
      console.error('恢复失败:', error);
    }
  };

  const handleComplete = async () => {
    if (!confirm('确认完成盘点周期？完成后将无法修改。')) return;

    try {
      await fetch(`/api/stocktaking/cycles/${id}/complete`, { method: 'POST' });
      fetchData();
    } catch (error) {
      console.error('完成失败:', error);
      alert('完成失败，请重试');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; bg: string }> = {
      PLANNED: { text: '待盘点', bg: 'bg-blue-100 text-blue-700' },
      COUNTED: { text: '已盘点', bg: 'bg-green-100 text-green-700' },
      ADJUSTED: { text: '已调整', bg: 'bg-yellow-100 text-yellow-700' },
    };
    const config = statusMap[status] || { text: status, bg: 'bg-gray-100 text-gray-700' };
    return <span className={`px-2 py-1 rounded text-xs ${config.bg}`}>{config.text}</span>;
  };

  const getCycleStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; bg: string }> = {
      PLANNED: { text: '已计划', bg: 'bg-blue-100 text-blue-700' },
      IN_PROGRESS: { text: '进行中', bg: 'bg-green-100 text-green-700' },
      PAUSED: { text: '已暂停', bg: 'bg-yellow-100 text-yellow-700' },
      COMPLETED: { text: '已完成', bg: 'bg-gray-100 text-gray-700' },
      CANCELLED: { text: '已取消', bg: 'bg-red-100 text-red-700' },
    };
    const config = statusMap[status] || { text: status, bg: 'bg-gray-100 text-gray-700' };
    return <span className={`px-2 py-1 rounded text-xs ${config.bg}`}>{config.text}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!cycle) {
    return <div>盘点周期不存在</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/stocktaking-cycles')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{cycle.cycleName}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">周期信息</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">状态</span>
              {getCycleStatusBadge(cycle.status)}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">类型</span>
              <span>{cycle.cycleType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">开始时间</span>
              <span>{cycle.startDate ? new Date(cycle.startDate).toLocaleDateString('zh-CN') : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">结束时间</span>
              <span>{cycle.endDate ? new Date(cycle.endDate).toLocaleDateString('zh-CN') : '-'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">统计信息</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">总任务数</span>
              <span className="font-semibold">{stats?.totalCount || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">待盘点</span>
              <span className="font-semibold text-blue-600">{stats?.pendingCount || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">已盘点</span>
              <span className="font-semibold text-green-600">{stats?.countedCount || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">已调整</span>
              <span className="font-semibold text-yellow-600">{stats?.adjustedCount || 0}</span>
            </div>
            <div className="flex justify-between pt-3 border-t">
              <span className="text-gray-600">完成进度</span>
              <span className="font-semibold">
                {stats?.totalCount ? Math.round(((stats?.completedCount || 0) / stats.totalCount) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">操作</h3>
          <div className="space-y-3">
            {cycle.status === 'PLANNED' && (
              <button
                onClick={handleAssignTasks}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                <Play className="w-4 h-4" />
                分配任务
              </button>
            )}
            {cycle.status === 'IN_PROGRESS' && (
              <>
                <button
                  onClick={handlePause}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                >
                  <Pause className="w-4 h-4" />
                  暂停周期
                </button>
                <button
                  onClick={handleComplete}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  <Check className="w-4 h-4" />
                  完成周期
                </button>
              </>
            )}
            {cycle.status === 'PAUSED' && (
              <button
                onClick={handleResume}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                <Play className="w-4 h-4" />
                恢复周期
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">盘点任务列表</h3>
        </div>
        <div className="p-6">
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              暂无盘点任务
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => navigate(`/stocktaking-tasks/${task.id}`)}
                  className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium">任务 #{task.id}</span>
                    {getStatusBadge(task.status)}
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>预期数量: {task.expectedQuantity}</div>
                    <div>实际数量: {task.actualQuantity}</div>
                    {task.variance !== 0 && (
                      <div className="text-red-600">
                        差异: {task.variance > 0 ? '+' : ''}{task.variance}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}