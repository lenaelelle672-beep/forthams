import { useQuery } from '@tanstack/react-query';
import { getLocationTree } from '@/api/base';
import { Select, SelectItem } from '@/components/ui/Select';
import type { Location } from '@/types/common';

interface LocationTreeSelectProps {
  value?: number;
  onChange?: (value: number | undefined) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  excludeId?: number;
}

function flattenTree(
  nodes: Location[],
  excludeId?: number,
  level = 0,
): (Location & { _level: number })[] {
  const result: (Location & { _level: number })[] = [];
  for (const node of nodes) {
    if (node.id === excludeId) continue;
    result.push({ ...node, _level: level });
    if (node.children && node.children.length > 0) {
      result.push(...flattenTree(node.children, excludeId, level + 1));
    }
  }
  return result;
}

export function LocationTreeSelect({
  value,
  onChange,
  label,
  error,
  placeholder = '请选择父级位置',
  disabled,
  excludeId,
}: LocationTreeSelectProps) {
  const { data: treeRes } = useQuery({
    queryKey: ['locations', 'tree'],
    queryFn: getLocationTree,
    staleTime: 1000 * 60 * 5,
  });

  const locations = treeRes as unknown as Location[] | undefined;
  const flatLocations = locations ? flattenTree(locations, excludeId) : [];

  return (
    <Select
      value={value != null ? String(value) : undefined}
      onValueChange={(v) => onChange?.(v ? Number(v) : undefined)}
      label={label}
      error={error}
      placeholder={placeholder}
      disabled={disabled}
    >
      <SelectItem value="__clear__">（顶级位置）</SelectItem>
      {flatLocations.map((loc) => (
        <SelectItem key={loc.id} value={String(loc.id)}>
          <span style={{ marginLeft: `${loc._level * 16}px` }}>
            {'\u3000'.repeat(loc._level)}
            {loc.name}
          </span>
        </SelectItem>
      ))}
    </Select>
  );
}
