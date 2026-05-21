import { Search, Trash2, UserCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { userApi, type UserRecord } from '@/api/workflow';
import { FLOW_NODE_CATALOG, type FlowEdge, type FlowNode, type FlowNodeData } from '@/types/flow';

const badgeClass: Record<string, string> = {
  start: 'bg-green-100 text-green-700', approval: 'bg-blue-100 text-blue-700',
  condition: 'bg-amber-100 text-amber-700', end: 'bg-red-100 text-red-700',
};

const selectCls = 'flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

interface Props {
  selectedNode: FlowNode | null;
  edges: FlowEdge[];
  approverRoles?: string[];
  roleDetails?: Array<{ roleCode: string; roleName: string }>;
  onUpdateNode: (id: string, patch: Partial<FlowNodeData> & Record<string, unknown>) => void;
  onDeleteNode: (id: string) => void;
}

export function NodeConfigPanel({ selectedNode, edges, approverRoles = [], roleDetails = [], onUpdateNode, onDeleteNode }: Props) {
  const [userQ, setUserQ] = useState('');
  const [userResults, setUserResults] = useState<UserRecord[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [showUserDrop, setShowUserDrop] = useState(false);

  const approverType: 'role' | 'user' = useMemo(() => {
    if (!selectedNode) return 'role';
    return (selectedNode.data as Record<string, unknown>).approverType === 'user' ? 'user' : 'role';
  }, [selectedNode]);

  const approverId: string = useMemo(() => {
    if (!selectedNode) return '';
    const v = (selectedNode.data as Record<string, unknown>).approverId;
    return typeof v === 'string' ? v : '';
  }, [selectedNode]);

  const selectedUserName = useMemo(() => {
    if (!approverId || approverType !== 'user') return '';
    const u = userResults.find((r) => String(r.id) === approverId);
    return u?.realName || u?.username || approverId;
  }, [approverId, approverType, userResults]);

  const searchUsers = useCallback(async (kw: string) => {
    setUserQ(kw);
    if (!kw.trim()) { setUserResults([]); return; }
    setUserLoading(true);
    try { const list = await userApi.search(kw); setUserResults(Array.isArray(list) ? list : []); }
    catch { setUserResults([]); }
    finally { setUserLoading(false); }
  }, []);

  useEffect(() => {
    if (!approverId || approverType !== 'user') return;
    if (!userResults.some((u) => String(u.id) === approverId)) {
      userApi.getById(approverId).then((u) => { if (u) setUserResults((p) => [u, ...p.filter((x) => String(x.id) !== approverId)]); }).catch(() => {});
    }
  }, [approverId, approverType, userResults]);

  if (!selectedNode) {
    return (
      <div className="flex h-full flex-col gap-4 rounded-2xl bg-[#eff4ff] p-4">
        <div className="rounded-2xl bg-white/90 p-4 shadow-sm">
          <div className="text-base font-semibold text-gray-900 mb-2">节点属性</div>
          <div className="text-xs text-gray-500 mb-4">请选择画布中的节点，在这里编辑属性</div>
          <div className="grid grid-cols-2 gap-3">
            {(['开始', '审批', '条件', '结束'] as const).map((label, i) => {
              const cls = ['bg-green-50 text-green-700', 'bg-blue-50 text-blue-700', 'bg-amber-50 text-amber-700', 'bg-red-50 text-red-700'][i];
              const sub = ['流程触发', '审批决策', '条件分流', '流程收口'][i];
              return <div key={label} className={`rounded-xl p-3 ${cls}`}><div className="text-xs font-semibold">{label}</div><div className="text-[11px] mt-1 opacity-70">{sub}</div></div>;
            })}
          </div>
        </div>
      </div>
    );
  }

  const t = selectedNode.type;
  const edgeCount = edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).length;

  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl bg-[#eff4ff] p-4">
      <div className="flex h-full flex-col rounded-2xl bg-white/90 shadow-sm">
        <div className="p-4 pb-3 space-y-3 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div><div className="text-base font-semibold text-gray-900">节点属性</div><div className="text-xs text-gray-500 mt-1">{FLOW_NODE_CATALOG[t].helper}</div></div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeClass[t]}`}>{FLOW_NODE_CATALOG[t].label}</span>
          </div>
          <div className="text-xs text-gray-400">{selectedNode.data.nodeCode} · {edgeCount} 条连线</div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-700">节点名称</label><input className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" value={selectedNode.data.label} onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })} /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-700">节点说明</label><textarea rows={2} className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none" value={selectedNode.data.description} onChange={(e) => onUpdateNode(selectedNode.id, { description: e.target.value })} /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-gray-700">节点编码</label><input className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" value={selectedNode.data.nodeCode} onChange={(e) => onUpdateNode(selectedNode.id, { nodeCode: e.target.value })} /></div>

          <hr className="border-gray-100" />

          {t === 'start' && (
            <div className="space-y-1.5"><label className="text-xs font-medium text-gray-700">触发方式</label><select className={selectCls} value={selectedNode.data.triggerType} onChange={(e) => onUpdateNode(selectedNode.id, { triggerType: e.target.value })}><option value="表单提交">表单提交</option><option value="定时触发">定时触发</option><option value="接口调用">接口调用</option><option value="手动发起">手动发起</option></select></div>
          )}

          {t === 'approval' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">审批人类型</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer"><input type="radio" name={`at-${selectedNode.id}`} checked={approverType === 'role'} onChange={() => onUpdateNode(selectedNode.id, { approverType: 'role', approverId: '', approverRole: '' })} className="text-blue-600" />按角色</label>
                  <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer"><input type="radio" name={`at-${selectedNode.id}`} checked={approverType === 'user'} onChange={() => onUpdateNode(selectedNode.id, { approverType: 'user', approverId: '', approverRole: '' })} className="text-blue-600" />指定用户</label>
                </div>
              </div>
              {approverType === 'role' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700">审批角色</label>
                  <select className={selectCls} value={selectedNode.data.approverRole} onChange={(e) => { if (e.target.value) onUpdateNode(selectedNode.id, { approverRole: e.target.value }); }}>
                    <option value="">选择角色</option>
                    {roleDetails.length > 0 ? roleDetails.map((r) => <option key={r.roleCode} value={r.roleCode}>{r.roleName}（{r.roleCode}）</option>) : approverRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700">指定审批用户</label>
                  {approverId && selectedUserName && (
                    <div className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
                      <UserCheck className="size-4 text-blue-500" /><span className="text-gray-900">{selectedUserName}</span>
                      <button type="button" className="ml-auto text-xs text-gray-400 hover:text-gray-600" onClick={() => onUpdateNode(selectedNode.id, { approverId: '' })}>清除</button>
                    </div>
                  )}
                  <div className="relative">
                    <div className="flex gap-2">
                      <input placeholder="搜索用户..." className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" value={userQ} onChange={(e) => searchUsers(e.target.value)} onFocus={() => setShowUserDrop(true)} />
                      <button type="button" className="rounded-md border border-gray-200 px-2 text-gray-400 hover:text-blue-600" onClick={() => searchUsers(userQ)}><Search className="size-4" /></button>
                    </div>
                    {showUserDrop && userResults.length > 0 && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowUserDrop(false)} />
                        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                          {userResults.map((u) => (
                            <button key={u.id} type="button" className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2 ${String(u.id) === approverId ? 'bg-blue-50' : ''}`}
                              onClick={() => { onUpdateNode(selectedNode.id, { approverId: String(u.id), approverRole: '' }); setShowUserDrop(false); setUserQ(''); }}>
                              <UserCheck className="size-3.5 text-blue-500 shrink-0" /><span className="font-medium">{u.realName || u.username}</span><span className="text-xs text-gray-400">ID:{u.id}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">审批模式</label>
                <select className={selectCls} value={selectedNode.data.approvalMode} onChange={(e) => onUpdateNode(selectedNode.id, { approvalMode: e.target.value as FlowNodeData['approvalMode'] })}>
                  <option value="sequence">依次审批</option><option value="all">会签（全部通过）</option><option value="any">或签（任一通过）</option>
                </select>
              </div>
            </>
          )}

          {t === 'condition' && (
            <>
              <div className="space-y-1.5"><label className="text-xs font-medium text-gray-700">条件表达式</label><textarea rows={3} className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none" value={selectedNode.data.conditionExpression} onChange={(e) => onUpdateNode(selectedNode.id, { conditionExpression: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-xs font-medium text-gray-700">满足标签</label><input className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" value={selectedNode.data.trueLabel} onChange={(e) => onUpdateNode(selectedNode.id, { trueLabel: e.target.value })} /></div>
                <div className="space-y-1.5"><label className="text-xs font-medium text-gray-700">不满足标签</label><input className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" value={selectedNode.data.falseLabel} onChange={(e) => onUpdateNode(selectedNode.id, { falseLabel: e.target.value })} /></div>
              </div>
            </>
          )}

          {t === 'end' && (
            <div className="space-y-1.5"><label className="text-xs font-medium text-gray-700">结束动作</label><textarea rows={2} className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none" value={selectedNode.data.resultAction} onChange={(e) => onUpdateNode(selectedNode.id, { resultAction: e.target.value })} /></div>
          )}

          <hr className="border-gray-100" />

          <button type="button" className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors" onClick={() => onDeleteNode(selectedNode.id)}>
            <Trash2 className="size-4" />删除当前节点
          </button>
        </div>
      </div>
    </div>
  );
}
