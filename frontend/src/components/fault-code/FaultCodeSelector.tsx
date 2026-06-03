/**
 * @file components/fault-code/FaultCodeSelector.tsx
 * @description 故障代码级联选择器（三级联动：现象→原因→措施）
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { getFaultCodeTree, getFaultCodeByLevel, getFaultCodeChildren } from '@/api/faultCode';
import type { FaultCode } from '@/types/faultCode';

interface FaultCodeSelectorProps {
  value?: number;
  onChange: (faultCodeId: number | undefined, label: string) => void;
  disabled?: boolean;
}

export default function FaultCodeSelector({ value, onChange, disabled }: FaultCodeSelectorProps) {
  const [level1Id, setLevel1Id] = useState<number | undefined>();
  const [level2Id, setLevel2Id] = useState<number | undefined>();
  const [level3Id, setLevel3Id] = useState<number | undefined>();
  const [level1List, setLevel1List] = useState<FaultCode[]>([]);
  const [level2List, setLevel2List] = useState<FaultCode[]>([]);
  const [level3List, setLevel3List] = useState<FaultCode[]>([]);

  // 加载一级（故障现象）
  const { data: treeRes } = useQuery({
    queryKey: ['fault-codes', 'tree'],
    queryFn: () => getFaultCodeTree(),
  });

  useEffect(() => {
    const tree = (treeRes as any)?.data ?? [];
    setLevel1List(tree);
  }, [treeRes]);

  // 选择一级 → 加载二级
  function handleLevel1Change(id: number | undefined) {
    setLevel1Id(id);
    setLevel2Id(undefined);
    setLevel3Id(undefined);
    setLevel2List([]);
    setLevel3List([]);
    onChange(undefined, '');
    if (id) {
      getFaultCodeChildren(id).then((res: any) => {
        setLevel2List(res?.data ?? []);
      });
    }
  }

  // 选择二级 → 加载三级
  function handleLevel2Change(id: number | undefined) {
    setLevel2Id(id);
    setLevel3Id(undefined);
    setLevel3List([]);
    onChange(undefined, '');
    if (id) {
      getFaultCodeChildren(id).then((res: any) => {
        setLevel3List(res?.data ?? []);
      });
    }
  }

  // 选择三级
  function handleLevel3Change(id: number | undefined) {
    setLevel3Id(id);
    if (id && level1List) {
      const l1 = level1List.find(n => n.id === level1Id);
      const l2 = level2List.find(n => n.id === level2Id);
      const l3 = level3List.find(n => n.id === id);
      const label = [l1?.code, l2?.code, l3?.code].filter(Boolean).join(' / ');
      onChange(id, label);
    } else {
      onChange(undefined, '');
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* 一级：故障现象 */}
      <select
        className="w-full h-11 rounded-xl border border-[#d7deea] text-sm px-3 bg-white/95 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] disabled:opacity-50"
        value={level1Id ?? ''}
        onChange={e => handleLevel1Change(e.target.value ? Number(e.target.value) : undefined)}
        disabled={disabled}
      >
        <option value="">选择故障现象</option>
        {level1List.map(node => (
          <option key={node.id} value={node.id}>
            [{node.code}] {node.faultPhenomenon || '-'}
          </option>
        ))}
      </select>

      {level1Id && (
        <>
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          {/* 二级：故障原因 */}
          <select
            className="w-full h-11 rounded-xl border border-[#d7deea] text-sm px-3 bg-white/95 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] disabled:opacity-50"
            value={level2Id ?? ''}
            onChange={e => handleLevel2Change(e.target.value ? Number(e.target.value) : undefined)}
            disabled={disabled}
          >
            <option value="">选择故障原因</option>
            {level2List.map(node => (
              <option key={node.id} value={node.id}>
                [{node.code}] {node.faultCause || '-'}
              </option>
            ))}
          </select>
        </>
      )}

      {level2Id && (
        <>
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          {/* 三级：解决措施 */}
          <select
            className="w-full h-11 rounded-xl border border-[#d7deea] text-sm px-3 bg-white/95 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] disabled:opacity-50"
            value={level3Id ?? ''}
            onChange={e => handleLevel3Change(e.target.value ? Number(e.target.value) : undefined)}
            disabled={disabled}
          >
            <option value="">选择解决措施</option>
            {level3List.map(node => (
              <option key={node.id} value={node.id}>
                [{node.code}] {node.solution || '-'}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
