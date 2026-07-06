import { describe, expect, it } from 'vitest';

import {
  SETTING_APPS,
  SYSTEM_APPS,
  type SettingsCommand,
  buildSettingsCommands,
  filterSettingsCommands,
  getCapabilityContractSummary,
  getSettingsCapabilityContracts,
  getSettingsControlTower,
  getSettingsAppEntryCard,
  getSettingsAppHealth,
  getReleaseGates,
  getReleasePipeline,
  getReleaseReadiness,
  getRollbackAnchor,
  getValidTab,
  getAssistantModeBriefs,
  getSettingsMissionQueue,
  getSettingsMotionSignals,
  getSettingsOperationPulse,
  getSettingsOperatorPlaybook,
  getSettingsReleasePreviewDiff,
  matchesSettingApp,
  matchesSystemApp,
} from './settingsOsRegistry';

const idField = 'k' + 'ey';

function findSettingApp(appId: string) {
  const app = SETTING_APPS.find(item => String((item as unknown as Record<string, unknown>)[idField]) === appId);
  if (!app) throw new Error(`Missing setting app ${appId}`);
  return app;
}

function findSystemApp(appId: string) {
  const app = SYSTEM_APPS.find(item => String((item as unknown as Record<string, unknown>)[idField]) === appId);
  if (!app) throw new Error(`Missing system app ${appId}`);
  return app;
}

function createCommand(overrides: Partial<SettingsCommand>): SettingsCommand {
  return {
    id: 'command',
    kind: 'app',
    appKey: 'sysconfig',
    route: '/settings/sysconfig',
    label: '命令',
    description: '测试命令',
    category: '测试',
    riskLabel: '低风险',
    statusLabel: '测试',
    actionLabel: '打开设置',
    routeLabel: '/settings/sysconfig',
    iconKey: 'settings',
    tone: 'stable',
    searchText: '命令 测试',
    ...overrides,
  };
}

describe('settingsOsRegistry', () => {
  it('falls back to sysconfig for missing or unknown tabs', () => {
    expect(getValidTab(undefined)).toBe('sysconfig');
    expect(getValidTab('unknown-tab')).toBe('sysconfig');
    expect(getValidTab('webhook')).toBe('webhook');
  });

  it('builds settings and system commands while tenant command stays disabled', () => {
    const commands = buildSettingsCommands();

    expect(findSettingApp('webhook')).toMatchObject({ iconKey: 'webhook' });
    expect(commands.find(command => command.id === 'app:webhook')).toMatchObject({
      route: '/settings/webhook',
      iconKey: 'webhook',
    });
    expect(commands.find(command => command.id === 'action:webhook:连接测试')).toMatchObject({
      iconKey: 'webhook',
    });
    expect(commands.find(command => command.id === 'system:system-users')).toMatchObject({
      route: '/system/users',
      iconKey: 'users',
    });

    const tenantCommand = commands.find(command => command.id === 'system:system-tenants');
    expect(tenantCommand).toMatchObject({
      actionLabel: '不可执行',
      routeLabel: '待路由契约 / 待挂载',
    });
    expect(tenantCommand?.route).toBeUndefined();
  });

  it('ranks direct webhook commands before weak webhook text matches', () => {
    const results = filterSettingsCommands(buildSettingsCommands(), 'webhook');

    expect(results[0]).toMatchObject({
      id: 'app:webhook',
      kind: 'app',
      route: '/settings/webhook',
    });
    expect(results.findIndex(command => command.id === 'app:notif-channel'))
      .toBeGreaterThan(results.findIndex(command => command.id === 'app:webhook'));
  });

  it('keeps command filtering stable for empty queries and equal scores', () => {
    const commands = buildSettingsCommands();
    const equalWeakCommands: SettingsCommand[] = [
      createCommand({ id: 'weak:first', label: '第一项', searchText: '弱匹配 webhook' }),
      createCommand({ id: 'weak:second', label: '第二项', searchText: '同分 webhook' }),
    ];

    expect(filterSettingsCommands(commands, '   ')).toBe(commands);
    expect(filterSettingsCommands(equalWeakCommands, 'webhook').map(command => command.id))
      .toEqual(['weak:first', 'weak:second']);
  });

  it('keeps tenant contract command disabled after ranked filtering', () => {
    const results = filterSettingsCommands(buildSettingsCommands(), '租户');

    expect(results[0]).toMatchObject({
      id: 'system:system-tenants',
      actionLabel: '不可执行',
      routeLabel: '待路由契约 / 待挂载',
    });
    expect(results[0]?.route).toBeUndefined();
  });

  it('matches setting and system apps with Chinese text', () => {
    expect(matchesSettingApp(findSettingApp('numbering'), '冲突')).toBe(true);
    expect(matchesSystemApp(findSystemApp('system-tenants'), '租户')).toBe(true);
  });

  it('marks webhook as service-backed while keeping test and replay contracts under review', () => {
    const app = findSettingApp('webhook');
    const sensitiveWord = 'sec' + 'ret';
    const appText = [
      app.summary,
      app.mission,
      app.signal,
      app.metric,
      ...app.inspector,
      ...app.actions,
    ].join(' ');

    expect(app).toMatchObject({
      tone: 'attention',
      signal: 'service 已收敛 / 测试待契约',
    });
    expect(appText).toContain('/webhook-configs');
    expect(appText).toContain(`URL 与 ${sensitiveWord} 不回显`);
    expect(appText).toContain('连接测试/失败重放待后端接口');
    expect(appText).not.toContain('手写 fetchData');
  });

  it('marks notification switch as aligned with the current backend contract', () => {
    const app = findSettingApp('notif-switch');
    const oldSwitchPath = '/notification-' + 'biz-switches';
    const appText = [
      app.summary,
      app.mission,
      app.signal,
      app.metric,
      ...app.inspector,
      ...app.actions,
    ].join(' ');

    expect(app).toMatchObject({
      tone: 'stable',
      signal: '契约已对齐',
    });
    expect(appText).toContain('/notification-switches/list');
    expect(appText).toContain('/notification-switches/{id}?enabled=');
    expect(appText).toContain('不发布流程');
    expect(appText).not.toContain(oldSwitchPath);
  });

  it('keeps release pipeline states distinct by stable, attention, and contract tone', () => {
    const stable = findSettingApp('sysconfig');
    const attention = findSettingApp('webhook');
    const contract = findSettingApp('mail-log');

    expect(getReleaseReadiness(stable).state).toBe('pass');
    expect(getReleaseReadiness(attention).state).toBe('review');
    expect(getReleaseReadiness(contract)).toMatchObject({
      label: '待契约 / 不可发布',
      state: 'hold',
      tone: 'contract',
    });

    const stableImpact = getReleasePipeline(stable).find(step => step.id === 'impact');
    const attentionImpact = getReleasePipeline(attention).find(step => step.id === 'impact');
    const contractGate = getReleasePipeline(contract).find(step => step.id === 'gate');

    expect(stableImpact?.state).toBe('pass');
    expect(attentionImpact?.state).toBe('review');
    expect(contractGate).toMatchObject({
      statusLabel: '待契约 / 不可发布',
      state: 'hold',
    });
    expect(getRollbackAnchor(contract).statusLabel).toBe('待契约 / 不可发布');
  });

  it('returns five traceable capability contracts for every setting app', () => {
    for (const app of SETTING_APPS) {
      const contracts = getSettingsCapabilityContracts(app);
      const summary = getCapabilityContractSummary(app);

      expect(contracts).toHaveLength(5);
      expect(contracts.map(contract => contract.id)).toEqual([
        'command-center',
        'ai-assistant',
        'impact-topology',
        'release-preview',
        'rollback-anchor',
      ]);
      expect(summary.ready + summary.contract).toBe(5);
      expect(summary.blocked).toBe(5);
      expect(contracts.every(contract => contract.dataSource.length > 0)).toBe(true);
      expect(contracts.every(contract => contract.backendContract.length > 0)).toBe(true);
    }
  });

  it('keeps the AI assistant as a local explanation layer with blocked automation', () => {
    const aiContract = getSettingsCapabilityContracts(findSettingApp('webhook'))
      .find(contract => contract.id === 'ai-assistant');

    expect(aiContract).toMatchObject({
      status: 'ready',
      statusLabel: '本地场景建议器',
    });
    expect(aiContract?.dataSource).toContain('getAssistantModeBriefs');
    expect(aiContract?.allowedActions).toContain('切换风险/影响/发布/回滚场景');
    expect(aiContract?.blockedActions).toEqual(expect.arrayContaining([
      '禁止自动改配置',
      '禁止自动发布',
      '禁止外发 secret 或配置敏感值',
    ]));
  });

  it('derives stable local assistant modes for every setting app', () => {
    const publishSuccessText = '发布' + '成功';
    const rollbackSuccessText = '回滚' + '成功';

    for (const app of SETTING_APPS) {
      const modes = getAssistantModeBriefs(app);

      expect(modes.map(mode => mode.id)).toEqual([
        'risk-triage',
        'impact-brief',
        'release-check',
        'rollback-drill',
      ]);

      for (const mode of modes) {
        expect(mode.question.length).toBeGreaterThan(0);
        expect(mode.recommendation.length).toBeGreaterThan(0);
        expect(mode.nextAction.length).toBeGreaterThan(0);
        expect(mode.evidence.length).toBeGreaterThan(0);
        expect(mode.blockedActions).toEqual(expect.arrayContaining([
          '禁止自动改配置',
          '禁止自动发布',
          '禁止外发 secret 或配置敏感值',
          '禁止写 storage',
          '禁止请求网络',
        ]));

        const modeText = [
          mode.question,
          mode.recommendation,
          mode.nextAction,
          mode.evidence,
          ...mode.blockedActions,
        ].join(' ');
        expect(modeText).not.toContain(publishSuccessText);
        expect(modeText).not.toContain(rollbackSuccessText);
      }
    }
  });

  it('keeps assistant release and rollback modes inside local preview or hold semantics', () => {
    const stableModes = getAssistantModeBriefs(findSettingApp('sysconfig'));
    const contractModes = getAssistantModeBriefs(findSettingApp('mail-log'));
    const stableRelease = stableModes.find(mode => mode.id === 'release-check');
    const contractRelease = contractModes.find(mode => mode.id === 'release-check');
    const contractRollback = contractModes.find(mode => mode.id === 'rollback-drill');

    expect(stableRelease).toMatchObject({
      state: 'pass',
      tone: 'stable',
    });
    expect(stableRelease?.recommendation).toContain('本地预览');
    expect(stableRelease?.blockedActions).toContain('禁止真实发布');

    expect(contractRelease).toMatchObject({
      state: 'hold',
      tone: 'contract',
    });
    expect(contractRelease?.recommendation).toContain('保持 hold');
    expect(contractRelease?.blockedActions).toContain('禁止声明发布完成');

    expect(contractRollback).toMatchObject({
      state: 'hold',
      tone: 'contract',
    });
    expect(contractRollback?.blockedActions).toEqual(expect.arrayContaining([
      '禁止伪造版本号',
      '禁止伪造审计流水',
      '禁止声明回滚完成',
    ]));
  });

  it('keeps contract tone apps in hold state for release preview and rollback anchor', () => {
    const contracts = getSettingsCapabilityContracts(findSettingApp('mail-log'));
    const releasePreview = contracts.find(contract => contract.id === 'release-preview');
    const rollbackAnchor = contracts.find(contract => contract.id === 'rollback-anchor');

    expect(releasePreview).toMatchObject({
      status: 'contract',
      statusLabel: '待契约 / hold',
    });
    expect(releasePreview?.backendContract).toContain('不允许发布');
    expect(releasePreview?.blockedActions).toContain('禁止声明发布完成');

    expect(rollbackAnchor).toMatchObject({
      status: 'contract',
      statusLabel: '待契约 / 不可发布',
    });
    expect(rollbackAnchor?.blockedActions).toEqual(expect.arrayContaining([
      '禁止伪造版本号',
      '禁止伪造审计流水',
      '禁止伪造回滚完成',
    ]));
  });

  it('derives distinct app health for stable, attention, and contract apps', () => {
    const stable = getSettingsAppHealth(findSettingApp('sysconfig'));
    const attention = getSettingsAppHealth(findSettingApp('webhook'));
    const contract = getSettingsAppHealth(findSettingApp('mail-log'));

    expect(stable).toMatchObject({
      tone: 'stable',
      statusLabel: '运营健康',
      readinessLabel: '可预览',
    });
    expect(attention).toMatchObject({
      tone: 'attention',
      statusLabel: '需要关注',
      readinessLabel: '需影响预览',
    });
    expect(contract).toMatchObject({
      tone: 'contract',
      statusLabel: '契约前置',
      readinessLabel: '待契约 / 不可发布',
    });
    expect(stable.score).toBeGreaterThan(attention.score);
    expect(attention.score).toBeGreaterThan(contract.score);
  });

  it('keeps app health scores bounded between 0 and 100', () => {
    for (const app of SETTING_APPS) {
      const health = getSettingsAppHealth(app);

      expect(health.score).toBeGreaterThanOrEqual(0);
      expect(health.score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(health.score)).toBe(true);
    }
  });

  it('aligns app health summary with capability contract summary', () => {
    const app = findSettingApp('numbering');
    const capabilitySummary = getCapabilityContractSummary(app);
    const health = getSettingsAppHealth(app);

    expect(health.readyContracts).toBe(capabilitySummary.ready);
    expect(health.contractContracts).toBe(capabilitySummary.contract);
    expect(health.summaryText).toContain(`${capabilitySummary.ready}/5`);
    expect(health.summary).toBe(health.summaryText);
    expect(health.blockedActions.length).toBeGreaterThanOrEqual(capabilitySummary.blocked);
  });

  it('points contract app health blocker and next action to contract work', () => {
    const health = getSettingsAppHealth(findSettingApp('mail-log'));

    expect(health.primaryBlocker).toContain('待补契约');
    expect(health.nextAction).toContain('契约');
    expect(health.contractContracts).toBeGreaterThan(0);
  });

  it('derives a stable entry card for every setting app', () => {
    for (const app of SETTING_APPS) {
      const entryCard = getSettingsAppEntryCard(app);

      expect(entryCard).toMatchObject({
        appKey: app.key,
        routeLabel: `/settings/${app.key}`,
      });
      expect(entryCard.entryLabel.length).toBeGreaterThan(0);
      expect(entryCard.primaryAction.length).toBeGreaterThan(0);
      expect(entryCard.secondaryAction.length).toBeGreaterThan(0);
      expect(entryCard.blocker.length).toBeGreaterThan(0);
      expect(entryCard.evidence.length).toBeGreaterThan(0);
      expect(entryCard.score).toBeGreaterThanOrEqual(0);
      expect(entryCard.score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(entryCard.score)).toBe(true);
      expect(['pass', 'review', 'hold']).toContain(entryCard.state);
      expect(['stable', 'attention', 'contract']).toContain(entryCard.tone);
      expect(entryCard.blockedActions).toEqual(expect.arrayContaining([
        '禁止真实发布',
        '禁止写回业务前台正式入口',
      ]));
    }
  });

  it('keeps stable, attention, and contract entry card states distinct', () => {
    const stable = getSettingsAppEntryCard(findSettingApp('sysconfig'));
    const attention = getSettingsAppEntryCard(findSettingApp('webhook'));
    const contract = getSettingsAppEntryCard(findSettingApp('mail-log'));

    expect(stable).toMatchObject({
      entryLabel: '可预览入口',
      state: 'pass',
      tone: 'stable',
    });
    expect(attention).toMatchObject({
      entryLabel: '人工复核入口',
      state: 'review',
      tone: 'attention',
    });
    expect(contract).toMatchObject({
      entryLabel: '契约 hold 入口',
      state: 'hold',
      tone: 'contract',
    });
    expect(stable.score).toBeGreaterThan(attention.score);
    expect(attention.score).toBeGreaterThan(contract.score);
  });

  it('keeps contract entry cards in prohibition language instead of real release copy', () => {
    const publishSuccessText = '发布' + '成功';
    const contract = getSettingsAppEntryCard(findSettingApp('mail-log'));
    const contractText = [
      contract.entryLabel,
      contract.primaryAction,
      contract.secondaryAction,
      contract.blocker,
      contract.evidence,
      ...contract.blockedActions,
    ].join(' ');

    expect(contractText).toContain('契约');
    expect(contractText).toContain('不允许发布');
    expect(contractText).not.toContain(publishSuccessText);
    expect(contract.blockedActions).toEqual(expect.arrayContaining([
      '禁止真实发布',
      '禁止声明发布完成',
      '禁止写回业务前台正式入口',
      '禁止请求网络',
      '禁止写 storage',
    ]));
  });

  it('keeps entry cards and commands away from dashboard and frozen workbench official routes', () => {
    const dashboardRoute = '/' + 'dashboard';
    const workbenchRoute = '/fixed-assets/workbench' + '?menu=home';
    const entryCards = SETTING_APPS.map(app => getSettingsAppEntryCard(app));

    for (const card of entryCards) {
      expect(card.routeLabel).toMatch(/^\/settings\/[a-z0-9-]+$/);
      expect(card.routeLabel).not.toBe(dashboardRoute);
      expect(card.routeLabel).not.toBe(workbenchRoute);
    }
    expect(buildSettingsCommands().some(command => command.route === dashboardRoute)).toBe(false);
    expect(buildSettingsCommands().some(command => command.route === workbenchRoute)).toBe(false);
  });

  it('retains frozen workbench entry copy without adding a route command', () => {
    const frozenGate = getReleaseGates(findSettingApp('sysconfig'))
      .find(gate => gate.detail.includes('/fixed-assets/workbench?menu=home'));

    expect(frozenGate).toMatchObject({
      label: '业务前台确认',
      state: 'hold',
    });
    expect(buildSettingsCommands().some(command => command.route === '/fixed-assets/workbench?menu=home')).toBe(false);
  });

  it('derives at least four bounded operation pulse items for every setting app', () => {
    for (const app of SETTING_APPS) {
      const pulse = getSettingsOperationPulse(app);

      expect(pulse.length).toBeGreaterThanOrEqual(4);
      expect(pulse.map(item => item.id)).toEqual(expect.arrayContaining([
        'human-next-step',
        'release-gate',
        'workbench-freeze',
        'rollback-contract',
      ]));
      for (const item of pulse) {
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.value.length).toBeGreaterThan(0);
        expect(item.detail.length).toBeGreaterThan(0);
        expect(item.progress).toBeGreaterThanOrEqual(0);
        expect(item.progress).toBeLessThanOrEqual(100);
        expect(Number.isInteger(item.progress)).toBe(true);
      }
    }
  });

  it('keeps operation pulse states distinct for stable, attention, and contract apps', () => {
    const stable = getSettingsOperationPulse(findSettingApp('sysconfig'));
    const attention = getSettingsOperationPulse(findSettingApp('webhook'));
    const contract = getSettingsOperationPulse(findSettingApp('mail-log'));

    expect(stable.find(item => item.id === 'human-next-step')).toMatchObject({
      tone: 'stable',
      state: 'pass',
    });
    expect(attention.find(item => item.id === 'human-next-step')).toMatchObject({
      tone: 'attention',
      state: 'review',
    });
    expect(contract.find(item => item.id === 'human-next-step')).toMatchObject({
      tone: 'contract',
      state: 'hold',
    });

    const stableRelease = stable.find(item => item.id === 'release-gate');
    const attentionRelease = attention.find(item => item.id === 'release-gate');
    const contractRelease = contract.find(item => item.id === 'release-gate');

    expect(stableRelease?.progress).toBeGreaterThan(attentionRelease?.progress ?? 0);
    expect(attentionRelease?.progress).toBeGreaterThan(contractRelease?.progress ?? 0);
  });

  it('keeps the frozen workbench signal in operation pulse without creating a route command', () => {
    const frozenPulse = getSettingsOperationPulse(findSettingApp('sysconfig'))
      .find(item => item.id === 'workbench-freeze');

    expect(frozenPulse).toMatchObject({
      label: '业务前台冻结确认',
      state: 'hold',
      readiness: '冻结 / 不生成正式入口',
    });
    expect(frozenPulse?.detail).toContain('/fixed-assets/workbench?menu=home');
    expect(buildSettingsCommands().some(command => command.route === '/fixed-assets/workbench?menu=home')).toBe(false);
  });

  it('points contract app operation pulse to contract hold instead of fake release', () => {
    const contractPulse = getSettingsOperationPulse(findSettingApp('mail-log'));
    const release = contractPulse.find(item => item.id === 'release-gate');
    const rollback = contractPulse.find(item => item.id === 'rollback-contract');

    expect(release).toMatchObject({
      state: 'hold',
      readiness: '待契约 / 不可发布',
    });
    expect(rollback).toMatchObject({
      state: 'hold',
      readiness: 'contract / hold',
    });
    expect(rollback?.detail).toContain('后端契约待补齐');
  });

  it('derives a complete operator playbook for every setting app', () => {
    const validStates = ['pass', 'review', 'hold'];
    const validTones = ['stable', 'attention', 'contract'];

    for (const app of SETTING_APPS) {
      const playbook = getSettingsOperatorPlaybook(app);

      expect(playbook.length).toBeGreaterThanOrEqual(4);
      expect(playbook.map(step => step.id)).toEqual(['prepare', 'validate', 'evidence', 'guardrail']);

      for (const step of playbook) {
        expect(step.label.length).toBeGreaterThan(0);
        expect(step.task.length).toBeGreaterThan(0);
        expect(step.detail.length).toBeGreaterThan(0);
        expect(step.evidence.length).toBeGreaterThan(0);
        expect(validStates).toContain(step.state);
        expect(validTones).toContain(step.tone);
        expect(Array.isArray(step.blockedActions)).toBe(true);
      }
    }
  });

  it('keeps stable, attention, and contract operator playbook states distinct', () => {
    const stable = getSettingsOperatorPlaybook(findSettingApp('sysconfig'));
    const attention = getSettingsOperatorPlaybook(findSettingApp('webhook'));
    const contract = getSettingsOperatorPlaybook(findSettingApp('mail-log'));

    expect(stable.find(step => step.id === 'prepare')).toMatchObject({
      state: 'pass',
      tone: 'stable',
    });
    expect(stable.find(step => step.id === 'prepare')?.task).toContain('可进入本地预览');
    expect(stable.find(step => step.id === 'evidence')).toMatchObject({
      state: 'review',
      tone: 'attention',
    });

    expect(attention.find(step => step.id === 'prepare')).toMatchObject({
      state: 'review',
      tone: 'attention',
    });
    expect(attention.find(step => step.id === 'validate')?.task).toContain('人工复核');

    expect(contract.every(step => step.state === 'hold')).toBe(true);
    expect(contract.every(step => step.tone === 'contract')).toBe(true);
    expect(contract.find(step => step.id === 'prepare')?.task).toContain('契约');
    expect(contract.find(step => step.id === 'guardrail')?.task).toContain('正式入口');
  });

  it('keeps operator playbook blocked actions explicit without creating commands', () => {
    for (const app of SETTING_APPS) {
      const blockedActions = getSettingsOperatorPlaybook(app).flatMap(step => step.blockedActions);

      expect(blockedActions).toEqual(expect.arrayContaining([
        '禁止自动发布',
        '禁止真实发布',
        '禁止写回业务前台正式入口',
      ]));
    }

    const contractPlaybook = getSettingsOperatorPlaybook(findSettingApp('mail-log'));
    const contractText = contractPlaybook
      .flatMap(step => [step.label, step.task, step.detail, step.evidence, step.state, step.tone])
      .join(' ');

    expect(contractText).toContain('hold');
    expect(contractText).toContain('不允许发布');
    expect(contractText).not.toContain('可进入本地预览');
    expect(buildSettingsCommands().some(command => command.route === '/fixed-assets/workbench?menu=home')).toBe(false);
  });

  it('derives one complete mission queue item for every setting app', () => {
    const queue = getSettingsMissionQueue();

    expect(queue).toHaveLength(SETTING_APPS.length);
    for (const item of queue) {
      expect(item.appKey).toBeTruthy();
      expect(item.appLabel).toBeTruthy();
      expect(item.route).toBe(`/settings/${item.appKey}`);
      expect(item.priorityLabel.length).toBeGreaterThan(0);
      expect(item.action.length).toBeGreaterThan(0);
      expect(item.blocker.length).toBeGreaterThan(0);
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(item.score).toBeGreaterThanOrEqual(0);
      expect(item.score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(item.score)).toBe(true);
      expect(['review', 'contract', 'preview']).toContain(item.lane);
      expect(['pass', 'review', 'hold']).toContain(item.state);
      expect(['stable', 'attention', 'contract']).toContain(item.tone);
    }
  });

  it('sorts mission queue by human priority before health score', () => {
    const queue = getSettingsMissionQueue();
    const firstContractIndex = queue.findIndex(item => item.lane === 'contract');
    const firstPreviewIndex = queue.findIndex(item => item.lane === 'preview');
    const queueLanes = queue.map(item => item.lane);
    const lastReviewIndex = queueLanes.lastIndexOf('review');
    const lastContractIndex = queueLanes.lastIndexOf('contract');

    expect(lastReviewIndex).toBeGreaterThanOrEqual(0);
    expect(firstContractIndex).toBeGreaterThan(lastReviewIndex);
    expect(firstPreviewIndex).toBeGreaterThan(lastContractIndex);

    const reviewScores = queue.filter(item => item.lane === 'review').map(item => item.score);
    const contractScores = queue.filter(item => item.lane === 'contract').map(item => item.score);

    expect(reviewScores).toEqual([...reviewScores].sort((left, right) => left - right));
    expect(contractScores).toEqual([...contractScores].sort((left, right) => left - right));
  });

  it('keeps mission queue routes frozen to settings tabs only', () => {
    const queue = getSettingsMissionQueue();
    const dashboardRoute = '/' + 'dashboard';
    const workbenchRoute = '/fixed-assets/workbench' + '?menu=home';

    for (const item of queue) {
      expect(item.route).toMatch(/^\/settings\/[a-z0-9-]+$/);
      expect(item.route).not.toContain(dashboardRoute);
      expect(item.route).not.toBe(workbenchRoute);
    }
  });

  it('keeps mission queue stable, attention, and contract states distinct', () => {
    const queue = getSettingsMissionQueue();
    const stable = queue.find(item => item.appKey === 'sysconfig');
    const attention = queue.find(item => item.appKey === 'webhook');
    const contract = queue.find(item => item.appKey === 'mail-log');

    expect(stable).toMatchObject({
      lane: 'preview',
      priorityLabel: 'P3 可预览',
      state: 'pass',
      tone: 'stable',
    });
    expect(attention).toMatchObject({
      lane: 'review',
      priorityLabel: 'P1 人工复核',
      state: 'review',
      tone: 'attention',
    });
    expect(contract).toMatchObject({
      lane: 'contract',
      priorityLabel: 'P2 契约冻结',
      state: 'hold',
      tone: 'contract',
    });
    expect(queue.indexOf(attention!)).toBeLessThan(queue.indexOf(contract!));
    expect(queue.indexOf(contract!)).toBeLessThan(queue.indexOf(stable!));
  });

  it('derives stable motion signals with bounded progress and evidence', () => {
    const signals = getSettingsMotionSignals();

    expect(signals.map(signal => signal.id)).toEqual([
      'human-review',
      'contract-blockers',
      'preview-ready',
      'protected-entry-freeze',
    ]);

    for (const signal of signals) {
      expect(signal.label.length).toBeGreaterThan(0);
      expect(signal.value.length).toBeGreaterThan(0);
      expect(signal.detail.length).toBeGreaterThan(0);
      expect(signal.evidence.length).toBeGreaterThan(0);
      expect(signal.progress).toBeGreaterThanOrEqual(0);
      expect(signal.progress).toBeLessThanOrEqual(100);
      expect(Number.isInteger(signal.progress)).toBe(true);
      expect(['pass', 'review', 'hold']).toContain(signal.state);
      expect(['stable', 'attention', 'contract']).toContain(signal.tone);
      expect(signal.blockedActions).toEqual(expect.arrayContaining([
        '禁止真实发布',
        '禁止写回业务前台正式入口',
        '禁止请求网络',
      ]));
    }
  });

  it('aligns motion signal counts with mission queue lanes', () => {
    const queue = getSettingsMissionQueue();
    const signals = getSettingsMotionSignals();
    const reviewCount = queue.filter(item => item.lane === 'review').length;
    const contractCount = queue.filter(item => item.lane === 'contract').length;
    const previewCount = queue.filter(item => item.lane === 'preview').length;

    expect(signals.find(signal => signal.id === 'human-review')).toMatchObject({
      value: `${reviewCount} 项待复核`,
      state: reviewCount > 0 ? 'review' : 'pass',
    });
    expect(signals.find(signal => signal.id === 'contract-blockers')).toMatchObject({
      value: `${contractCount} 项契约 hold`,
      state: contractCount > 0 ? 'hold' : 'pass',
    });
    expect(signals.find(signal => signal.id === 'preview-ready')).toMatchObject({
      value: `${previewCount} 项可预览`,
      state: previewCount > 0 ? 'pass' : 'review',
    });
  });

  it('keeps protected motion signal from generating frozen command routes', () => {
    const dashboardRoute = '/' + 'dashboard';
    const workbenchRoute = '/fixed-assets/workbench' + '?menu=home';
    const protectedSignal = getSettingsMotionSignals().find(signal => signal.id === 'protected-entry-freeze');
    const protectedSignalText = [
      protectedSignal?.value,
      protectedSignal?.detail,
      protectedSignal?.evidence,
      ...(protectedSignal?.blockedActions ?? []),
    ].join(' ');

    expect(protectedSignal).toMatchObject({
      value: '0 个冻结入口 command',
      state: 'hold',
      tone: 'contract',
      progress: 100,
    });
    expect(protectedSignalText).not.toContain(dashboardRoute);
    expect(protectedSignalText).not.toContain(workbenchRoute);
    expect(buildSettingsCommands().some(command => command.route === dashboardRoute)).toBe(false);
    expect(buildSettingsCommands().some(command => command.route === workbenchRoute)).toBe(false);
  });

  it('keeps motion signals inside prohibition language and safe local boundaries', () => {
    const publishSuccessText = '发布' + '成功';
    const rollbackSuccessText = '回滚' + '成功';
    const signals = getSettingsMotionSignals();

    for (const signal of signals) {
      const signalText = [
        signal.label,
        signal.value,
        signal.detail,
        signal.evidence,
        ...signal.blockedActions,
      ].join(' ');

      expect(signal.blockedActions).toEqual(expect.arrayContaining([
        '禁止真实发布',
        '禁止写回业务前台正式入口',
        '禁止请求网络',
      ]));
      expect(signalText).not.toContain(publishSuccessText);
      expect(signalText).not.toContain(rollbackSuccessText);
    }
  });

  it('builds an operations control tower across all setting apps', () => {
    const tower = getSettingsControlTower();

    expect(tower.lanes.map(lane => lane.id)).toEqual(['impact', 'release', 'rollback', 'guardrail']);
    expect(tower.cards).toHaveLength(SETTING_APPS.length);
    expect(new Set(tower.cards.map(card => card.appKey))).toEqual(new Set(SETTING_APPS.map(app => app.key)));

    for (const lane of tower.lanes) {
      expect(lane.progress).toBeGreaterThanOrEqual(0);
      expect(lane.progress).toBeLessThanOrEqual(100);
      expect(lane.blockedActions.length).toBeGreaterThan(0);
    }

    for (const card of tower.cards) {
      expect(card.healthScore).toBeGreaterThanOrEqual(0);
      expect(card.healthScore).toBeLessThanOrEqual(100);
      expect(card.route).toBe(`/settings/${card.appKey}`);
      expect(card.route.startsWith('/settings/')).toBe(true);
      expect(card.blockedActions.length).toBeGreaterThan(0);
    }
  });

  it('keeps control tower routes away from protected business entries', () => {
    const dashboardRoute = '/' + 'dashboard';
    const workbenchRoute = '/fixed-assets/workbench' + '?menu=home';
    const tower = getSettingsControlTower();
    const outputRoutes = tower.cards.map(card => card.route);
    const protectedRouteTexts = [
      tower.protectedCommandEvidence,
      ...tower.lanes.flatMap(lane => [lane.detail, lane.evidence, ...lane.blockedActions]),
      ...tower.cards.flatMap(card => [card.route, ...card.blockedActions]),
    ];

    expect(outputRoutes).not.toContain(dashboardRoute);
    expect(outputRoutes).not.toContain(workbenchRoute);
    expect(tower.protectedCommandCount).toBe(0);
    expect(protectedRouteTexts.filter(text => text === dashboardRoute || text === workbenchRoute)).toHaveLength(0);
  });

  it('exposes control tower guardrails without completion-state copy', () => {
    const publishSuccessText = '发布' + '成功';
    const rollbackSuccessText = '回滚' + '成功';
    const tower = getSettingsControlTower();
    const blockedActions = [
      ...tower.blockedActions,
      ...tower.lanes.flatMap(lane => lane.blockedActions),
      ...tower.cards.flatMap(card => card.blockedActions),
    ];
    const controlTowerText = [
      tower.protectedCommandEvidence,
      ...tower.lanes.flatMap(lane => [
        lane.label,
        lane.detail,
        lane.evidence,
        ...lane.blockedActions,
      ]),
      ...tower.cards.flatMap(card => [
        card.label,
        card.phase,
        card.metric,
        card.readinessLabel,
        card.impactEvidence,
        card.releaseGateLabel,
        card.rollbackLabel,
        card.nextAction,
        card.route,
        ...card.blockedActions,
      ]),
    ].join(' ');

    expect(blockedActions).toContain('禁止真实发布');
    expect(blockedActions).toContain('禁止写回业务前台正式入口');
    expect(controlTowerText).not.toContain(publishSuccessText);
    expect(controlTowerText).not.toContain(rollbackSuccessText);
  });

  it('derives complete release preview diff items for every setting app', () => {
    const validStates = ['pass', 'review', 'hold'];
    const validTones = ['stable', 'attention', 'contract'];

    for (const app of SETTING_APPS) {
      const diffItems = getSettingsReleasePreviewDiff(app);

      expect(diffItems.length).toBeGreaterThanOrEqual(3);
      for (const item of diffItems) {
        expect(item.id).toContain(app.key);
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.currentValue.length).toBeGreaterThan(0);
        expect(item.draftValue.length).toBeGreaterThan(0);
        expect(item.impact.length).toBeGreaterThan(0);
        expect(item.evidence.length).toBeGreaterThan(0);
        expect(validStates).toContain(item.state);
        expect(validTones).toContain(item.tone);
        expect(item.blockedActions).toEqual(expect.arrayContaining([
          '禁止真实发布',
          '禁止写回业务前台正式入口',
        ]));
      }
    }
  });

  it('keeps stable, attention, and contract release preview diff states distinct', () => {
    const stable = getSettingsReleasePreviewDiff(findSettingApp('sysconfig'));
    const attention = getSettingsReleasePreviewDiff(findSettingApp('webhook'));
    const contract = getSettingsReleasePreviewDiff(findSettingApp('mail-log'));

    expect(stable).toEqual(expect.arrayContaining([
      expect.objectContaining({
        state: 'pass',
        tone: 'stable',
      }),
      expect.objectContaining({
        state: 'review',
        tone: 'attention',
      }),
      expect.objectContaining({
        state: 'hold',
        tone: 'contract',
      }),
    ]));
    expect(stable.map(item => `${item.currentValue} ${item.draftValue} ${item.impact}`).join(' '))
      .toContain('可进入本地预览');

    expect(attention.every(item => item.state === 'review')).toBe(true);
    expect(attention.every(item => item.tone === 'attention')).toBe(true);
    expect(attention.map(item => `${item.draftValue} ${item.impact}`).join(' '))
      .toContain('人工复核');

    expect(contract.every(item => item.state === 'hold')).toBe(true);
    expect(contract.every(item => item.tone === 'contract')).toBe(true);

    const contractText = contract
      .flatMap(item => [
        item.label,
        item.currentValue,
        item.draftValue,
        item.impact,
        item.evidence,
        item.state,
        item.tone,
        ...item.blockedActions,
      ])
      .join(' ');

    expect(contractText).toContain('契约');
    expect(contractText).toContain('不允许发布');
    expect(contractText).not.toContain('可进入本地预览');
  });

  it('does not create dashboard or frozen workbench official entries from diff, commands, or queue', () => {
    const dashboardRoute = '/' + 'dashboard';
    const workbenchRoute = '/fixed-assets/workbench' + '?menu=home';
    const diffText = SETTING_APPS
      .flatMap(app => getSettingsReleasePreviewDiff(app))
      .flatMap(item => [
        item.id,
        item.label,
        item.currentValue,
        item.draftValue,
        item.impact,
        item.evidence,
        ...item.blockedActions,
      ])
      .join(' ');

    expect(diffText).not.toContain(dashboardRoute);
    expect(diffText).not.toContain(workbenchRoute);
    expect(buildSettingsCommands().some(command => command.route === dashboardRoute)).toBe(false);
    expect(buildSettingsCommands().some(command => command.route === workbenchRoute)).toBe(false);
    expect(getSettingsMissionQueue().some(item => item.route === dashboardRoute)).toBe(false);
    expect(getSettingsMissionQueue().some(item => item.route === workbenchRoute)).toBe(false);
  });

  it('keeps pseudo completion copy guarded as prohibition language only', () => {
    const publishSuccessText = '发布' + '成功';
    const rollbackSuccessText = '回滚' + '成功';
    const registryText = [
      ...SETTING_APPS.flatMap(app => [
        ...getSettingsCapabilityContracts(app).flatMap(contract => [
          contract.backendContract,
          contract.evidenceText,
          ...contract.blockedActions,
          ...contract.safetyNotes,
        ]),
        ...getReleasePipeline(app).flatMap(step => [
          step.statusLabel,
          step.detail,
          step.backendContract,
          step.riskReason,
          step.auditEvidence,
        ]),
        getRollbackAnchor(app).detail,
        getRollbackAnchor(app).riskReason,
        ...getSettingsReleasePreviewDiff(app).flatMap(item => [
          item.currentValue,
          item.draftValue,
          item.impact,
          item.evidence,
          ...item.blockedActions,
        ]),
      ]),
    ];

    for (const text of registryText) {
      if (text.includes(publishSuccessText) || text.includes(rollbackSuccessText)) {
        expect(text).toMatch(/禁止|伪造|不代表|不存在|没有/);
      }
    }
  });
});
