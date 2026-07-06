/**
 * @file components/reliability/RankingTable.tsx
 * @description 资产可靠性排名表
 */

import type { ReliabilityRanking } from '@/types/reliability';

interface RankingTableProps {
  data: ReliabilityRanking[];
  sortBy: string;
}

export default function RankingTable({ data, sortBy }: RankingTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        暂无排名数据
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-2 font-medium text-gray-500 w-12">#</th>
            <th className="text-left py-3 px-2 font-medium text-gray-500">资产名称</th>
            <th className="text-left py-3 px-2 font-medium text-gray-500">资产编码</th>
            <th className={`text-right py-3 px-2 font-medium ${sortBy === 'MTBF' ? 'text-blue-600' : 'text-gray-500'}`}>
              MTBF (h)
            </th>
            <th className={`text-right py-3 px-2 font-medium ${sortBy === 'MTTR' ? 'text-blue-600' : 'text-gray-500'}`}>
              MTTR (h)
            </th>
            <th className={`text-right py-3 px-2 font-medium ${sortBy === 'AVAILABILITY' ? 'text-blue-600' : 'text-gray-500'}`}>
              可用性
            </th>
            <th className="text-right py-3 px-2 font-medium text-gray-500">故障次数</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const rankColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600', 'text-gray-500', 'text-gray-500'];
            const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : null;
            return (
              <tr key={item.assetId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-3 px-2">
                  {medal ? <span className="text-lg">{medal}</span> : <span className="text-gray-400">{index + 1}</span>}
                </td>
                <td className="py-3 px-2 font-medium text-gray-800">{item.assetName}</td>
                <td className="py-3 px-2 font-mono text-xs text-gray-500">{item.assetCode}</td>
                <td className="py-3 px-2 text-right font-mono">{item.mtbf.toFixed(1)}</td>
                <td className="py-3 px-2 text-right font-mono">{item.mttr.toFixed(1)}</td>
                <td className="py-3 px-2 text-right font-mono">{item.availability.toFixed(1)}%</td>
                <td className="py-3 px-2 text-right">{item.failureCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
