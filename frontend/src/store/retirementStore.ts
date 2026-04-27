/**
 * retirementStore.ts
 * SWARM-002: Asset retirement workflow state management
 * Purpose: Centralised store for asset retirement application lifecycle state,
 *          approvals, and audit history. Designed for testability and type safety.
 */

import { defineStore } from 'pinia';
import type { Ref, ComputedRef } from 'vue';
import { computed, ref, watch } from 'vue';
import type {
  RetirementApplication,
  RetirementHistory,
  ApprovalStep,
  AssetStatus,
} from '@/types/retirement.types';
import type { User } from '@/types/approval.types';
import {
  createRetirementApplication,
  fetchRetirementApplication,
  fetchRetirementHistory,
  submitApproval,
  withdrawApplication,
} from '@/services/retirementService';
import { useAuthStore } from '@/store/authStore';

export interface RetirementStoreState {
  applications: RetirementApplication[];
  history: RetirementHistory[];
  current: RetirementApplication | null;
  approvals: ApprovalStep[];
  status: AssetStatus;
  loading: boolean;
  error: string | null;
}

export const useRetirementStore = defineStore('retirement', () => {
  const state: Ref<RetirementStoreState> = ref({
    applications: [],
    history: [],
    current: null,
    approvals: [],
    status: 'normal',
    loading: false,
    error: null,
  });

  const authStore = useAuthStore();

  // --- Getters ---
  const myApplications: ComputedRef<RetirementApplication[]> = computed(() =>
    state.value.applications.filter((app) => app.applicant.id === authStore.user?.id)
  );

  const isPendingApproval: ComputedRef<boolean> = computed(
    () => state.value.current?.status === 'pending'
  );

  const canApprove: ComputedRef<boolean> = computed(() => {
    if (!state.value.current) return false;
    return (
      authStore.user?.role === 'admin' &&
      state.value.current.status === 'pending' &&
      state.value.approvals.some(
        (step) => step.approverId === authStore.user?.id && !step.done
      )
    );
  });

  // --- Actions ---
  async function createApplication(payload: {
    assetId: string;
    reason: string;
    expectedDate?: string;
  }): Promise<RetirementApplication> {
    state.value.loading = true;
    state.value.error = null;
    try {
      const app = await createRetirementApplication({
        assetId: payload.assetId,
        reason: payload.reason,
        expectedDate: payload.expectedDate ?? null,
      });
      state.value.applications.push(app);
      state.value.current = app;
      await loadHistory(app.assetId);
      return app;
    } catch (err: any) {
      state.value.error = err?.message ?? 'Failed to create application';
      throw err;
    } finally {
      state.value.loading = false;
    }
  }

  async function loadApplication(applicationId: string): Promise<RetirementApplication> {
    state.value.loading = true;
    state.value.error = null;
    try {
      const app = await fetchRetirementApplication(applicationId);
      state.value.current = app;
      state.value.applications = state.value.applications.filter((a) => a.id !== applicationId);
      state.value.applications.push(app);
      await loadHistory(app.assetId);
      return app;
    } catch (err: any) {
      state.value.error = err?.message ?? 'Failed to load application';
      throw err;
    } finally {
      state.value.loading = false;
    }
  }

  async function loadHistory(assetId: string): Promise<RetirementHistory[]> {
    state.value.loading = true;
    state.value.error = null;
    try {
      const history = await fetchRetirementHistory(assetId);
      state.value.history = history;
      return history;
    } catch (err: any) {
      state.value.error = err?.message ?? 'Failed to load history';
      throw err;
    } finally {
      state.value.loading = false;
    }
  }

  async function approve(comment: string = ''): Promise<RetirementApplication> {
    if (!state.value.current) throw new Error('No current application');
    state.value.loading = true;
    state.value.error = null;
    try {
      const result = await submitApproval(state.value.current.id, { approved: true, comment });
      state.value.current = result.application;
      state.value.approvals = result.approvals;
      state.value.status = result.application.status as AssetStatus;
      await loadHistory(result.application.assetId);
      return result.application;
    } catch (err: any) {
      state.value.error = err?.message ?? 'Approval failed';
      throw err;
    } finally {
      state.value.loading = false;
    }
  }

  async function reject(comment: string = ''): Promise<RetirementApplication> {
    if (!state.value.current) throw new Error('No current application');
    state.value.loading = true;
    state.value.error = null;
    try {
      const result = await submitApproval(state.value.current.id, { approved: false, comment });
      state.value.current = result.application;
      state.value.approvals = result.approvals;
      state.value.status = result.application.status as AssetStatus;
      await loadHistory(result.application.assetId);
      return result.application;
    } catch (err: any) {
      state.value.error = err?.message ?? 'Rejection failed';
      throw err;
    } finally {
      state.value.loading = false;
    }
  }

  async function withdraw(): Promise<RetirementApplication> {
    if (!state.value.current) throw new Error('No current application');
    state.value.loading = true;
    state.value.error = null;
    try {
      const result = await withdrawApplication(state.value.current.id);
      state.value.current = result.application;
      state.value.approvals = result.approvals;
      state.value.status = result.application.status as AssetStatus;
      await loadHistory(result.application.assetId);
      return result.application;
    } catch (err: any) {
      state.value.error = err?.message ?? 'Withdrawal failed';
      throw err;
    } finally {
      state.value.loading = false;
    }
  }

  return {
    state,
    myApplications,
    isPendingApproval,
    canApprove,
    createApplication,
    loadApplication,
    loadHistory,
    approve,
    reject,
    withdraw,
  };
});