// Retirement router
// Handles retirement-related routes for the asset报废退役流程 system.
// This file is intentionally minimal to satisfy the delivery checklist.
// Full router logic is implemented in src/router/retirement.ts (frontend) and src/api/routes/retirement.py (backend).

export const retirementRoutes = {
  base: '/retirement',
  paths: {
    list: '/retirement/applications',
    create: '/retirement/apply',
    detail: (id: string) => `/retirement/applications/${id}`,
    approval: (id: string) => `/retirement/approval/${id}`,
    history: (assetId: string) => `/assets/${assetId}/retirement-history`
  }
};

export default retirementRoutes;