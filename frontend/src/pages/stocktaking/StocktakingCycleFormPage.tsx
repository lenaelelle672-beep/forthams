import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Save } from 'lucide-react';

export default function StocktakingCycleFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    cycleName: '',
    cycleType: 'FULL',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = '/api/stocktaking/cycles';
      const method = 'POST';

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      navigate('/stocktaking-cycles');
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    }
  };

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

      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">
          {isEdit ? '编辑盘点周期' : '新建盘点周期'}
        </h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              周期名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.cycleName}
              onChange={(e) => setFormData({ ...formData, cycleName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              placeholder="例如：2024年6月循环盘点"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              盘点类型 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.cycleType}
              onChange={(e) => setFormData({ ...formData, cycleType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="FULL">全盘点</option>
              <option value="ABC">ABC 分类盘点</option>
              <option value="PARTIAL">部分盘点</option>
            </select>
          </div>

          <div className="pt-4 border-t">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              <Save className="w-4 h-4" />
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}