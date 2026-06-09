import { describe, expect, it } from 'vitest';
import { canAccessRoute } from './routePermissions';

describe('routePermissions', () => {
  it('keeps routes visible for legacy sessions without explicit permissions', () => {
    expect(canAccessRoute('/workflows', { roles: ['USER'], permissions: [] })).toBe(true);
  });

  it('allows super roles to see all mapped routes', () => {
    expect(canAccessRoute('/workflow-designer', { roles: ['SUPER_ADMIN'], permissions: [] })).toBe(true);
  });

  it('requires workflow query permission for workflow center', () => {
    expect(canAccessRoute('/workflows', { roles: ['USER'], permissions: ['workflow:definition:query'] })).toBe(true);
    expect(canAccessRoute('/workflows', { roles: ['USER'], permissions: ['asset:ledger:query'] })).toBe(false);
  });

  it('requires workflow edit permission for designer route', () => {
    expect(canAccessRoute('/workflow-designer', { roles: ['USER'], permissions: ['workflow:definition:edit'] })).toBe(true);
    expect(canAccessRoute('/workflow-designer', { roles: ['USER'], permissions: ['workflow:definition:query'] })).toBe(false);
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
  });

  it('requires specific disposal action permissions for action entry routes', () => {
    expect(canAccessRoute('/disposals/transfer/new', { roles: ['USER'], permissions: ['disposal:transfer'] })).toBe(true);
    expect(canAccessRoute('/disposals/transfer/new', { roles: ['USER'], permissions: ['disposal:query'] })).toBe(false);
    expect(canAccessRoute('/disposals', { roles: ['USER'], permissions: ['disposal:query'] })).toBe(true);
  });
});
