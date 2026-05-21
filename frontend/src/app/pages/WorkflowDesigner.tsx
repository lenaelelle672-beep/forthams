import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { addEdge, type Connection, useEdgesState, useNodesState } from "@xyflow/react";
import { useNavigate, useSearchParams } from "react-router";
import "@xyflow/react/dist/style.css";
import { Layers3, Sparkles, Workflow } from "lucide-react";

import { FlowCanvas } from "../components/flow/FlowCanvas";
import { NodeConfigPanel } from "../components/flow/NodeConfigPanel";
import { NodePanel } from "../components/flow/NodePanel";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { businessFlowOptions, getDraftStorageKey, isBusinessType, type BusinessType } from "../constants/workflowBusiness";
import { roleService, type RoleRecord } from "../services/roleService";
import { userService, type UserRecord } from "../services/userService";
import { workflowDefinitionService } from "../services/workflowDefinitionService";
import { normalizeWorkflowDefinition, validateWorkflowDefinition } from "../utils/workflowDefinition";
import {
  createFlowEdge,
  createFlowNode,
  initialFlowEdges,
  initialFlowNodes,
  type FlowEdge,
  type FlowDefinition,
  type FlowNode,
  type FlowNodeData,
  type FlowNodeType,
} from "../types/flow";

function cloneInitialNodes() {
  return initialFlowNodes.map((node) => ({ ...node, position: { ...node.position }, data: { ...node.data } }));
}

function cloneInitialEdges() {
  return initialFlowEdges.map((edge) => ({ ...edge, data: edge.data ? { ...edge.data } : edge.data }));
}

function readDraftFromStorage(businessType: BusinessType): Pick<FlowDefinition, "nodes" | "edges"> | null {
  try {
    const rawDraft = localStorage.getItem(getDraftStorageKey(businessType));
    if (!rawDraft) return null;

    const parsed = JSON.parse(rawDraft) as Partial<FlowDefinition>;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;

    const normalized = normalizeWorkflowDefinition(parsed as FlowDefinition, businessType);
    return { nodes: normalized.nodes, edges: normalized.edges };
  } catch {
    return null;
  }
}

function definitionFromApi(value: Record<string, unknown> | undefined, businessType: BusinessType): Pick<FlowDefinition, "nodes" | "edges"> | null {
  if (!value || !Array.isArray(value.nodes) || value.nodes.length === 0 || !Array.isArray(value.edges)) return null;
  const normalized = normalizeWorkflowDefinition(value as unknown as FlowDefinition, businessType);
  return { nodes: normalized.nodes, edges: normalized.edges };
}

function getAutoPosition(index: number) {
  const column = index % 2;
  const row = Math.floor(index / 2);

  return {
    x: 220 + column * 220,
    y: 120 + row * 160,
  };
}

function normalizeRecordList<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === "object") {
    const record = response as Record<string, unknown>;
    if (Array.isArray(record.records)) return record.records as T[];
    if (record.data) return normalizeRecordList<T>(record.data);
  }
  return [];
}

function readRoleField(role: RoleRecord, keys: string[]) {
  for (const key of keys) {
    const value = role[key];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return "";
}

function normalizeApproverRoles(response: unknown) {
  const roles = normalizeRecordList<RoleRecord>(response)
    .map((role) => readRoleField(role, ["roleCode", "role_code", "code", "value"]) || readRoleField(role, ["roleName", "role_name", "name", "label"]))
    .filter(Boolean);
  return Array.from(new Set(["SUPER_ADMIN", ...roles]));
}

const designerTokens = {
  "--workflow-surface": "#f8f9ff",
  "--workflow-panel": "#eff4ff",
  "--workflow-canvas": "#f4f7ff",
  "--workflow-grid": "rgba(67, 56, 218, 0.12)",
  "--workflow-start": "#16a34a",
  "--workflow-start-soft": "#dcfce7",
  "--workflow-approval": "#2563eb",
  "--workflow-approval-soft": "#dbeafe",
  "--workflow-condition": "#f59e0b",
  "--workflow-condition-soft": "#ffedd5",
  "--workflow-end": "#dc2626",
  "--workflow-end-soft": "#fee2e2",
} as CSSProperties;

export function WorkflowDesigner() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedBusinessType = searchParams.get("businessType");
  const businessType = isBusinessType(requestedBusinessType) ? requestedBusinessType : "ASSET_TRANSFER";
  const businessFlow = businessFlowOptions.find((option) => option.businessType === businessType) ?? businessFlowOptions[0];
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(cloneInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(cloneInitialEdges());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("approval-1");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<string>("UNCONFIGURED");
  const [serverVersion, setServerVersion] = useState(0);
  const [approverRoleOptions, setApproverRoleOptions] = useState<string[]>(["SUPER_ADMIN"]);
  const [roleDetailOptions, setRoleDetailOptions] = useState<Array<{ roleCode: string; roleName: string }>>([]);

  useEffect(() => {
    if (!isBusinessType(requestedBusinessType)) {
      setSearchParams({ businessType }, { replace: true });
    }
  }, [businessType, requestedBusinessType, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadDefinition() {
      setSaveError(null);
      try {
        const serverDefinition = await workflowDefinitionService.get(businessType);
        if (cancelled) return;
        const parsedDefinition = definitionFromApi(serverDefinition.definition, businessType);
        const nextNodes = parsedDefinition?.nodes ?? cloneInitialNodes();
        const nextEdges = parsedDefinition?.edges ?? cloneInitialEdges();
        setNodes(nextNodes);
        setEdges(nextEdges);
        setSelectedNodeId(nextNodes.find((node) => node.type === "approval")?.id ?? "approval-1");
        setServerStatus(serverDefinition.status);
        setServerVersion(serverDefinition.version);
        setSaveMessage(serverDefinition.id ? "已从后端恢复该业务类型的流程定义。" : null);
      } catch {
        if (cancelled) return;
        const storedDraft = readDraftFromStorage(businessType);
        const nextNodes = storedDraft?.nodes ?? cloneInitialNodes();
        const nextEdges = storedDraft?.edges ?? cloneInitialEdges();
        setNodes(nextNodes);
        setEdges(nextEdges);
        setSelectedNodeId(nextNodes.find((node) => node.type === "approval")?.id ?? "approval-1");
        setServerStatus("UNCONFIGURED");
        setServerVersion(0);
        setSaveMessage(storedDraft ? "后端暂不可用，已恢复本地流程定义草稿。" : null);
      }
    }

    loadDefinition();
    return () => {
      cancelled = true;
    };
  }, [businessType, setEdges, setNodes]);

  useEffect(() => {
    let cancelled = false;

    async function loadApproverRoles() {
      try {
        const rawRoles = normalizeRecordList<RoleRecord>(await roleService.getAll());
        const roleCodes = rawRoles
          .map((role) => readRoleField(role, ["roleCode", "role_code", "code", "value"]) || readRoleField(role, ["roleName", "role_name", "name", "label"]))
          .filter(Boolean);
        const uniqueCodes = Array.from(new Set(["SUPER_ADMIN", ...roleCodes]));
        if (!cancelled && uniqueCodes.length > 0) {
          setApproverRoleOptions(uniqueCodes);
          setRoleDetailOptions(rawRoles.map((role) => ({
            roleCode: readRoleField(role, ["roleCode", "role_code", "code", "value"]),
            roleName: readRoleField(role, ["roleName", "role_name", "name", "label"]),
          })).filter((r) => r.roleCode));
        }
      } catch {
        if (!cancelled) {
          setApproverRoleOptions(["SUPER_ADMIN"]);
          setRoleDetailOptions([]);
        }
      }
    }

    loadApproverRoles();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const flowDefinition = useMemo<FlowDefinition>(
    () => ({
      id: `WF-${businessType}`,
      name: businessFlow.name,
      description: businessFlow.description,
      nodes,
      edges,
    }),
    [businessFlow.description, businessFlow.name, businessType, edges, nodes],
  );

  const normalizedFlowDefinition = useMemo(
    () => normalizeWorkflowDefinition(flowDefinition, businessType),
    [businessType, flowDefinition],
  );

  const validationErrors = useMemo(
    () => validateWorkflowDefinition(normalizedFlowDefinition),
    [normalizedFlowDefinition],
  );

  const ensureValidDefinition = useCallback(
    (action: string) => {
      if (validationErrors.length === 0) return true;
      setSaveMessage(null);
      setSaveError(`${action}前请先补全流程设计：${validationErrors.join("；")}`);
      return false;
    },
    [validationErrors],
  );

  const handleBusinessTypeChange = useCallback(
    (nextBusinessType: string) => {
      if (!isBusinessType(nextBusinessType)) return;
      setSearchParams({ businessType: nextBusinessType });
    },
    [setSearchParams],
  );

  const handleAddNodeAtPosition = useCallback(
    (type: FlowNodeType, position?: { x: number; y: number }) => {
      setNodes((currentNodes) => {
        const newNode = createFlowNode(type, position ?? getAutoPosition(currentNodes.length), {
          data: {
            nodeCode: `${type.toUpperCase()}-${String(currentNodes.length + 1).padStart(3, "0")}`,
          },
        });
        setSelectedNodeId(newNode.id);
        return [...currentNodes, newNode];
      });
    },
    [setNodes],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      const edge = createFlowEdge(connection);
      if (!edge) {
        return;
      }

      if (edge.source === edge.target) {
        setSaveMessage(null);
        setSaveError("同一节点不能连接到自身");
        return;
      }

      setEdges((currentEdges) => {
        const duplicated = currentEdges.some((currentEdge) =>
          currentEdge.source === edge.source
          && currentEdge.target === edge.target
          && currentEdge.sourceHandle === edge.sourceHandle,
        );
        return duplicated ? currentEdges : addEdge(edge, currentEdges);
      });
    },
    [setEdges],
  );

  const handleUpdateNode = useCallback(
    (nodeId: string, patch: Partial<FlowNodeData>) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...patch,
                },
              }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId));
      setEdges((currentEdges) =>
        currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      );

      setSelectedNodeId((currentSelected) => {
        if (currentSelected !== nodeId) return currentSelected;
        return nodes.find((node) => node.id !== nodeId)?.id ?? null;
      });
    },
    [nodes, setEdges, setNodes],
  );

  const handleSaveDraft = useCallback(async () => {
    try {
      const savedDefinition = await workflowDefinitionService.saveDraft(businessType, {
        name: normalizedFlowDefinition.name,
        description: normalizedFlowDefinition.description,
        definition: normalizedFlowDefinition,
      });
      localStorage.setItem(getDraftStorageKey(businessType), JSON.stringify({ ...normalizedFlowDefinition, savedAt: new Date().toISOString() }));
      setServerStatus(savedDefinition.status);
      setServerVersion(savedDefinition.version);
      setSaveError(null);
      setSaveMessage(validationErrors.length > 0
        ? `${businessFlow.name}已保存到后端流程定义草稿，发布前仍需补全校验项。`
        : `${businessFlow.name}已保存到后端流程定义草稿。`);
    } catch (error) {
      try {
        localStorage.setItem(getDraftStorageKey(businessType), JSON.stringify({ ...normalizedFlowDefinition, savedAt: new Date().toISOString() }));
        setSaveMessage(`${businessFlow.name}已保存为本地流程定义草稿，后端保存失败后可稍后重试。`);
        setSaveError(error instanceof Error ? error.message : "后端保存流程草稿失败");
      } catch (storageError) {
        setSaveMessage(null);
        setSaveError(storageError instanceof Error ? storageError.message : "保存流程草稿失败");
      }
    }
  }, [businessFlow.name, businessType, normalizedFlowDefinition, validationErrors.length]);

  const handlePublish = useCallback(async () => {
    if (!ensureValidDefinition("发布")) {
      return;
    }

    try {
      await workflowDefinitionService.saveDraft(businessType, {
        name: normalizedFlowDefinition.name,
        description: normalizedFlowDefinition.description,
        definition: normalizedFlowDefinition,
      });
      localStorage.setItem(getDraftStorageKey(businessType), JSON.stringify({ ...normalizedFlowDefinition, savedAt: new Date().toISOString() }));
      const publishedDefinition = await workflowDefinitionService.publish(businessType);
      setServerStatus(publishedDefinition.status);
      setServerVersion(publishedDefinition.version);
      setSaveError(null);
      setSaveMessage(`${businessFlow.name}已发布为 v${publishedDefinition.version}，业务表单将按该流程进入审批。`);
    } catch (error) {
      setSaveMessage(null);
      const message = error instanceof Error ? error.message : "发布流程失败";
      setSaveError(message);
      // 提示用户检查审批节点配置是否合法（角色需存在且至少有一个启用用户）
      if (message.includes("审批角色") || message.includes("审批人")) {
        console.warn("[WorkflowDesigner] 发布校验失败，请检查审批节点配置:", message);
      }
    }
  }, [businessFlow.name, businessType, ensureValidDefinition, normalizedFlowDefinition]);

  return (
    <div className="space-y-6" style={designerTokens}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge className="rounded-full bg-[var(--workflow-approval-soft)] px-3 py-1 text-[var(--workflow-approval)]">
            Workflow Designer
          </Badge>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">审批流程可视化设计器</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              基于 Stitch 的企业级流程编辑模式，当前编辑：{businessFlow.name}（{businessType}）。草稿保存到后端流程定义，并保留本地副本。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="bg-white/80" onClick={() => navigate("/workflows")}>返回流程列表</Button>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-white/80 px-3 py-2 text-sm text-muted-foreground">
            业务流程
            <select
              value={businessType}
              onChange={(event) => handleBusinessTypeChange(event.target.value)}
              className="rounded-md border border-border bg-white px-2 py-1 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            >
              {businessFlowOptions.map((option) => (
                <option key={option.businessType} value={option.businessType}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <Button variant="outline" className="bg-white/80">
            <Layers3 className="size-4" />
            {flowDefinition.nodes.length} 个节点
          </Button>
          <Button variant="outline" className="bg-white/80">
            <Workflow className="size-4" />
            {serverStatus} v{serverVersion}
          </Button>
          <Button onClick={handleSaveDraft} className="bg-gradient-to-r from-primary to-[var(--workflow-approval)] text-primary-foreground hover:opacity-90">
            <Sparkles className="size-4" />
            保存流程草稿
          </Button>
          <Button onClick={handlePublish} variant="outline" className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100">
            <Workflow className="size-4" />
            发布并启用
          </Button>
        </div>
      </div>

      {saveMessage ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{saveMessage}</div> : null}
      {saveError ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div> : null}
      {validationErrors.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          <div className="font-semibold">流程设计待补全</div>
          <div>{validationErrors.join("；")}</div>
        </div>
      ) : null}

      <Card className="border-0 bg-[var(--workflow-surface)] shadow-none">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-4 rounded-[1.5rem] bg-white/80 p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--workflow-approval)]">{flowDefinition.id}</div>
              <div className="mt-1 text-xl font-semibold text-foreground">{flowDefinition.name}</div>
              <div className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{flowDefinition.description}</div>
              <div className="mt-3 text-xs text-muted-foreground">
                后端按租户与 businessType 持久化；本地副本 key：<code>{getDraftStorageKey(businessType)}</code>。
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-[1.25rem] bg-[color-mix(in_srgb,var(--workflow-start-soft)_70%,white)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--workflow-start)]">开始</div>
                <div className="mt-1 font-semibold text-foreground">{nodes.filter((node) => node.type === "start").length}</div>
              </div>
              <div className="rounded-[1.25rem] bg-[color-mix(in_srgb,var(--workflow-approval-soft)_70%,white)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--workflow-approval)]">审批</div>
                <div className="mt-1 font-semibold text-foreground">{nodes.filter((node) => node.type === "approval").length}</div>
              </div>
              <div className="rounded-[1.25rem] bg-[color-mix(in_srgb,var(--workflow-condition-soft)_70%,white)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--workflow-condition)]">条件</div>
                <div className="mt-1 font-semibold text-foreground">{nodes.filter((node) => node.type === "condition").length}</div>
              </div>
              <div className="rounded-[1.25rem] bg-[color-mix(in_srgb,var(--workflow-end-soft)_70%,white)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--workflow-end)]">结束</div>
                <div className="mt-1 font-semibold text-foreground">{nodes.filter((node) => node.type === "end").length}</div>
              </div>
            </div>
          </div>

          <div className="grid h-[calc(100vh-14rem)] min-h-[720px] grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
            <NodePanel onAddNode={(type) => handleAddNodeAtPosition(type)} />
            <FlowCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={handleConnect}
              onNodeSelect={(node) => setSelectedNodeId(node?.id ?? null)}
              onAddNodeAtPosition={handleAddNodeAtPosition}
            />
            <NodeConfigPanel
              selectedNode={selectedNode}
              edges={edges}
              approverRoles={approverRoleOptions}
              roleDetails={roleDetailOptions}
              onUpdateNode={handleUpdateNode}
              onDeleteNode={handleDeleteNode}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
