import { FileCode2, GitBranch, Search, Trash2, UserCheck, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Textarea } from "../ui/textarea";
import { userService, type UserRecord } from "../../services/userService";
import { FLOW_NODE_CATALOG, type FlowEdge, type FlowNode, type FlowNodeData } from "../../types/flow";

const typeBadgeClasses = {
  start: "bg-[var(--workflow-start-soft)] text-[var(--workflow-start)]",
  approval: "bg-[var(--workflow-approval-soft)] text-[var(--workflow-approval)]",
  condition: "bg-[var(--workflow-condition-soft)] text-[var(--workflow-condition)]",
  end: "bg-[var(--workflow-end-soft)] text-[var(--workflow-end)]",
} as const;

const nativeFieldClassName =
  "flex h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

interface RoleOption {
  roleCode: string;
  roleName: string;
}

interface NodeConfigPanelProps {
  selectedNode: FlowNode | null;
  edges: FlowEdge[];
  approverRoles?: string[];
  roleDetails?: RoleOption[];
  onUpdateNode: (nodeId: string, patch: Partial<FlowNodeData> & Record<string, unknown>) => void;
  onDeleteNode: (nodeId: string) => void;
}

export function NodeConfigPanel({ selectedNode, edges, approverRoles = [], roleDetails = [], onUpdateNode, onDeleteNode }: NodeConfigPanelProps) {
  const [userSearchKeyword, setUserSearchKeyword] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserRecord[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);

  // Read dynamic approverType/approverId from the node data (FlowNodeData extends Record<string, unknown>)
  const approverType: "role" | "user" = useMemo(() => {
    if (!selectedNode) return "role";
    const raw = (selectedNode.data as Record<string, unknown>).approverType;
    return raw === "user" ? "user" : "role";
  }, [selectedNode]);

  const approverId: string = useMemo(() => {
    if (!selectedNode) return "";
    const raw = (selectedNode.data as Record<string, unknown>).approverId;
    return typeof raw === "string" ? raw : "";
  }, [selectedNode]);

  const selectedUserName = useMemo(() => {
    if (!approverId || approverType !== "user") return "";
    const found = userSearchResults.find(u => String(u.id) === String(approverId));
    return found?.realName || found?.username || approverId;
  }, [approverId, approverType, userSearchResults]);

  /** Search users via real userService */
  const handleUserSearch = useCallback(async (keyword: string) => {
    setUserSearchKeyword(keyword);
    if (!keyword.trim()) {
      setUserSearchResults([]);
      return;
    }
    setUserSearchLoading(true);
    try {
      const results = await userService.search(keyword);
      const list = Array.isArray(results) ? results : [];
      setUserSearchResults(list);
    } catch {
      setUserSearchResults([]);
    } finally {
      setUserSearchLoading(false);
    }
  }, []);

  /** Load initial user info when approverId is set */
  useEffect(() => {
    if (!approverId || approverType !== "user") return;
    const alreadyLoaded = userSearchResults.some(u => String(u.id) === String(approverId));
    if (!alreadyLoaded) {
      userService.getById(approverId).then((user) => {
        if (user) setUserSearchResults(prev => [user, ...prev.filter(u => String(u.id) !== String(approverId))]);
      }).catch(() => { /* ignore */ });
    }
  }, [approverId, approverType, userSearchResults]);

  if (!selectedNode) {
    return (
      <div className="flex h-full flex-col gap-4 rounded-[1.5rem] bg-[var(--workflow-panel)] p-4">
        <Card className="border-0 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">节点属性</CardTitle>
            <CardDescription>请选择画布中的节点后，在这里编辑名称、描述、审批人和分支条件。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-[1.25rem] bg-[var(--workflow-surface)] p-4 leading-6">
              当前画布支持开始、审批、条件分支、结束四种节点；拖拽连线后可形成完整审批流。
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.25rem] bg-[color-mix(in_srgb,var(--workflow-start-soft)_70%,white)] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workflow-start)]">Start</div>
                <div className="mt-1 text-sm font-semibold text-foreground">流程触发</div>
              </div>
              <div className="rounded-[1.25rem] bg-[color-mix(in_srgb,var(--workflow-approval-soft)_70%,white)] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workflow-approval)]">Approval</div>
                <div className="mt-1 text-sm font-semibold text-foreground">审批决策</div>
              </div>
              <div className="rounded-[1.25rem] bg-[color-mix(in_srgb,var(--workflow-condition-soft)_70%,white)] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workflow-condition)]">Condition</div>
                <div className="mt-1 text-sm font-semibold text-foreground">条件分流</div>
              </div>
              <div className="rounded-[1.25rem] bg-[color-mix(in_srgb,var(--workflow-end-soft)_70%,white)] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workflow-end)]">End</div>
                <div className="mt-1 text-sm font-semibold text-foreground">流程收口</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentType = selectedNode.type;
  const edgeCount = edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id).length;

  return (
    <div className="flex h-full flex-col gap-4 rounded-[1.5rem] bg-[var(--workflow-panel)] p-4">
      <Card className="flex h-full flex-col border-0 bg-white/90 shadow-sm">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle className="text-base font-semibold">节点属性</CardTitle>
              <CardDescription>{FLOW_NODE_CATALOG[currentType].helper}</CardDescription>
            </div>
            <Badge className={typeBadgeClasses[currentType]}>{FLOW_NODE_CATALOG[currentType].label}</Badge>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileCode2 className="size-3.5" />
            <span>{selectedNode.data.nodeCode}</span>
            <span>·</span>
            <GitBranch className="size-3.5" />
            <span>{edgeCount} 条关联连线</span>
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-5 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="node-label">节点名称</Label>
            <Input
              id="node-label"
              value={selectedNode.data.label}
              onChange={(event) => onUpdateNode(selectedNode.id, { label: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-description">节点说明</Label>
            <Textarea
              id="node-description"
              rows={3}
              value={selectedNode.data.description}
              onChange={(event) => onUpdateNode(selectedNode.id, { description: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-code">节点编码</Label>
            <Input
              id="node-code"
              value={selectedNode.data.nodeCode}
              onChange={(event) => onUpdateNode(selectedNode.id, { nodeCode: event.target.value })}
            />
          </div>

          <Separator />

          {currentType === "start" && (
            <div className="space-y-2">
              <Label htmlFor="trigger-type">触发方式</Label>
              <select
                id="trigger-type"
                className={nativeFieldClassName}
                value={selectedNode.data.triggerType}
                onChange={(event) => onUpdateNode(selectedNode.id, { triggerType: event.target.value })}
              >
                <option value="表单提交">表单提交</option>
                <option value="定时触发">定时触发</option>
                <option value="接口调用">接口调用</option>
                <option value="手动发起">手动发起</option>
              </select>
            </div>
          )}

          {currentType === "approval" && (
            <>
              <div className="space-y-2">
                <Label>审批人类型</Label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name={`approverType-${selectedNode.id}`}
                      checked={approverType === "role"}
                      onChange={() => {
                        onUpdateNode(selectedNode.id, { approverType: "role", approverId: "", approverRole: "" });
                      }}
                      className="text-primary"
                    />
                    按角色审批
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name={`approverType-${selectedNode.id}`}
                      checked={approverType === "user"}
                      onChange={() => {
                        onUpdateNode(selectedNode.id, { approverType: "user", approverId: "", approverRole: "" });
                      }}
                      className="text-primary"
                    />
                    指定用户
                  </label>
                </div>
              </div>

              {approverType === "role" ? (
                <div className="space-y-2">
                  <Label htmlFor="approver-role">审批角色</Label>
                  <select
                    id="approver-role"
                    className={nativeFieldClassName}
                    value={approverRoles.includes(selectedNode.data.approverRole) ? selectedNode.data.approverRole : ""}
                    onChange={(event) => {
                      if (event.target.value) {
                        onUpdateNode(selectedNode.id, { approverRole: event.target.value });
                      }
                    }}
                  >
                    <option value="">从系统角色中选择</option>
                    {roleDetails.length > 0
                      ? roleDetails.map((role) => (
                          <option key={role.roleCode} value={role.roleCode}>
                            {role.roleName}（{role.roleCode}）
                          </option>
                        ))
                      : approverRoles.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))
                    }
                  </select>
                  <p className="text-xs text-muted-foreground">
                    角色列表来自系统角色管理，该角色下至少需有一个启用用户才能发布。
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="approver-user">指定审批用户</Label>
                  {approverId && selectedUserName ? (
                    <div className="flex items-center gap-2 rounded-md border border-input bg-input-background px-3 py-2">
                      <UserCheck className="size-4 text-primary" />
                      <span className="text-sm text-foreground">{selectedUserName}</span>
                      <span className="text-xs text-muted-foreground">（ID: {approverId}）</span>
                      <button
                        type="button"
                        className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => onUpdateNode(selectedNode.id, { approverId: "" })}
                      >
                        清除
                      </button>
                    </div>
                  ) : null}
                  <div className="relative">
                    <div className="flex gap-2">
                      <Input
                        placeholder="输入姓名/用户名搜索用户..."
                        value={userSearchKeyword}
                        onChange={(e) => handleUserSearch(e.target.value)}
                        onFocus={() => setShowUserSearch(true)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleUserSearch(userSearchKeyword)}
                      >
                        <Search className="size-4" />
                      </Button>
                    </div>
                    {showUserSearch && (userSearchResults.length > 0 || userSearchLoading) && (
                      <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-white shadow-lg">
                        {userSearchLoading ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">搜索中...</div>
                        ) : (
                          userSearchResults.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 ${
                                String(user.id) === approverId ? "bg-accent" : ""
                              }`}
                              onClick={() => {
                                onUpdateNode(selectedNode.id, {
                                  approverId: String(user.id),
                                  approverRole: "",
                                });
                                setShowUserSearch(false);
                                setUserSearchKeyword("");
                              }}
                            >
                              <UserCheck className="size-3.5 text-primary shrink-0" />
                              <span className="font-medium">{user.realName || user.username}</span>
                              <span className="text-xs text-muted-foreground">ID:{user.id}</span>
                              {user.phone && <span className="text-xs text-muted-foreground">{user.phone}</span>}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    {/* Click outside to close search */}
                    {showUserSearch && (
                      <div className="fixed inset-0 z-40" onClick={() => setShowUserSearch(false)} />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    用户列表来自系统用户管理，仅显示启用状态的用户。
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="approval-mode">审批模式</Label>
                <select
                  id="approval-mode"
                  className={nativeFieldClassName}
                  value={selectedNode.data.approvalMode}
                  onChange={(event) =>
                    onUpdateNode(selectedNode.id, {
                      approvalMode: event.target.value as FlowNodeData["approvalMode"],
                    })
                  }
                >
                  <option value="sequence">依次审批</option>
                  <option value="all">会签（全部通过）</option>
                  <option value="any">或签（任一通过）</option>
                </select>
              </div>
            </>
          )}

          {currentType === "condition" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="condition-expression">条件表达式</Label>
                <Textarea
                  id="condition-expression"
                  rows={4}
                  value={selectedNode.data.conditionExpression}
                  onChange={(event) => onUpdateNode(selectedNode.id, { conditionExpression: event.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="condition-true">满足条件标签</Label>
                  <Input
                    id="condition-true"
                    value={selectedNode.data.trueLabel}
                    onChange={(event) => onUpdateNode(selectedNode.id, { trueLabel: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="condition-false">不满足标签</Label>
                  <Input
                    id="condition-false"
                    value={selectedNode.data.falseLabel}
                    onChange={(event) => onUpdateNode(selectedNode.id, { falseLabel: event.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {currentType === "end" && (
            <div className="space-y-2">
              <Label htmlFor="result-action">结束动作</Label>
              <Textarea
                id="result-action"
                rows={3}
                value={selectedNode.data.resultAction}
                onChange={(event) => onUpdateNode(selectedNode.id, { resultAction: event.target.value })}
              />
            </div>
          )}

          <Separator />

          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={() => onDeleteNode(selectedNode.id)}
          >
            <Trash2 className="size-4" />
            删除当前节点
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
