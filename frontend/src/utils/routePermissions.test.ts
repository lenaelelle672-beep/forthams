import { describe, expect, it } from 'vitest';
import { canAccessRoute } from './routePermissions';

describe('routePermissions', () => {
  it('keeps non-flow routes visible for legacy sessions without explicit permissions', () => {
    expect(canAccessRoute('/assets', { roles: ['USER'], permissions: [] })).toBe(true);
  });

  it('allows super roles to see generic mapped routes', () => {
    expect(canAccessRoute('/assets', { roles: ['SUPER_ADMIN'], permissions: [] })).toBe(true);
  });

  it('requires the backend flow query permission for workflow center', () => {
    expect(canAccessRoute('/workflows', { roles: ['USER'], permissions: ['system:flow:query'] })).toBe(true);
    expect(canAccessRoute('/workflows', { roles: ['USER'], permissions: ['workflow:definition:query'] })).toBe(false);
    expect(canAccessRoute('/workflows', { roles: ['USER'], permissions: ['asset:ledger:query'] })).toBe(false);
    expect(canAccessRoute('/workflows', { roles: ['USER'], permissions: [] })).toBe(false);
  });

  it('protects the formal Workbench entry and ignores query strings when matching rules', () => {
    expect(canAccessRoute('/fixed-assets/workbench?menu=home', { roles: ['USER'], permissions: ['asset:ledger:query'] })).toBe(true);
    expect(canAccessRoute('/fixed-assets/workbench/assets?menu=asset', { roles: ['USER'], permissions: ['dashboard:query'] })).toBe(true);
    expect(canAccessRoute('/fixed-assets/workbench/security?menu=alarm', { roles: ['USER'], permissions: ['report:query'] })).toBe(false);
  });

  it('requires explicit platform administration and a designer action permission', () => {
    expect(canAccessRoute('/workflow-designer', {
      roles: ['TENANT_ADMIN'],
      permissions: ['asset:ledger:query', 'workflow:designer:edit'],
    })).toBe(false);
    expect(canAccessRoute('/workflow-designer', {
      roles: ['SUPER_ADMIN'],
      permissions: ['workflow:designer:edit'],
    })).toBe(false);
    expect(canAccessRoute('/workflow-designer', {
      roles: ['PLATFORM_OPERATOR'],
      platformAdmin: true,
      permissions: ['workflow:designer:edit'],
    })).toBe(true);
    expect(canAccessRoute('/workflow-designer?businessType=ASSET_TRANSFER', {
      roles: ['PLATFORM_OPERATOR'],
      platformAdmin: true,
      permissions: ['workflow:designer:publish'],
    })).toBe(true);
    expect(canAccessRoute('/workflow-designer', {
      roles: ['PLATFORM_OPERATOR'],
      platform_admin: true,
      permissions: ['workflow:designer:rollback'],
    })).toBe(true);
    expect(canAccessRoute('/workflow-designer', {
      roles: ['PLATFORM_OPERATOR'],
      platformAdmin: true,
      permissions: ['system:flow:query'],
    })).toBe(false);
    expect(canAccessRoute('/workflow-designer', {
      roles: ['PLATFORM_OPERATOR'],
      platformAdmin: true,
      permissions: ['workflow:definition:edit'],
    })).toBe(false);
  });

  it('matches desktop module routes to their backend query permissions', () => {
    expect(canAccessRoute('/purchase-orders', { roles: ['USER'], permissions: ['purchase:order:query'] })).toBe(true);
    expect(canAccessRoute('/contracts', { roles: ['USER'], permissions: ['contract:query'] })).toBe(true);
    expect(canAccessRoute('/sam', { roles: ['USER'], permissions: ['license:query'] })).toBe(true);
    expect(canAccessRoute('/purchase-orders', { roles: ['USER'], permissions: ['contract:query'] })).toBe(false);
  });

  it('uses the most specific settings permission before the generic settings rule', () => {
    expect(canAccessRoute('/settings/notif-template', { roles: ['USER'], permissions: ['notification:template:list'] })).toBe(true);
    expect(canAccessRoute('/settings/notif-template', { roles: ['USER'], permissions: ['system:config:query'] })).toBe(false);
    expect(canAccessRoute('/settings/sysconfig', { roles: ['USER'], permissions: ['system:config:query'] })).toBe(true);
    expect(canAccessRoute('/settings/webhook', { roles: ['USER'], permissions: ['system:config:query'] })).toBe(true);
    expect(canAccessRoute('/settings/webhook', { roles: ['USER'], permissions: ['system:config:edit'] })).toBe(true);
    expect(canAccessRoute('/settings/webhook', { roles: ['USER'], permissions: ['system:config'] })).toBe(false);
    expect(canAccessRoute('/settings-v2/mail-template', { roles: ['USER'], permissions: ['mail:template:list'] })).toBe(true);
    expect(canAccessRoute('/settings-v2/mail-template', { roles: ['USER'], permissions: ['system:config:query'] })).toBe(false);
  });

  it('keeps disposal listing and action entry permissions aligned with backend endpoints', () => {
    expect(canAccessRoute('/disposals/transfer/new', { roles: ['USER'], permissions: ['disposal:create'] })).toBe(true);
    expect(canAccessRoute('/disposals/clearance/new', { roles: ['USER'], permissions: ['disposal:create'] })).toBe(true);
    expect(canAccessRoute('/disposals/scrap/new', { roles: ['USER'], permissions: ['disposal:create'] })).toBe(true);
    expect(canAccessRoute('/disposals/transfer/new', { roles: ['USER'], permissions: ['disposal:query'] })).toBe(false);
    expect(canAccessRoute('/disposals', { roles: ['USER'], permissions: ['disposal:query'] })).toBe(true);
    expect(canAccessRoute('/disposals/12', { roles: ['USER'], permissions: ['compensation:query'] })).toBe(false);
  });

  it('lets compensation readers enter the compensation list without granting creation', () => {
    const creator = { roles: ['USER'], permissions: ['compensation:create'] };
    const reader = { roles: ['USER'], permissions: ['compensation:query'] };

    expect(canAccessRoute('/compensation', reader)).toBe(true);
    expect(canAccessRoute('/disposals?tab=COMPENSATION', reader)).toBe(true);
    expect(canAccessRoute('/compensation', creator)).toBe(false);
    expect(canAccessRoute('/compensation/new', creator)).toBe(true);
    expect(canAccessRoute('/disposals/compensation/new?legacy=true', creator)).toBe(true);
    expect(canAccessRoute('/compensation/new', reader)).toBe(false);
    expect(canAccessRoute('/compensation/12', reader)).toBe(true);
    expect(canAccessRoute('/compensation/12', creator)).toBe(false);
  });
});
