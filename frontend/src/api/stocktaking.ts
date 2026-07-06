import http from '@/utils/http';

export interface StocktakingCycle {
  id: number;
  cycleName: string;
  cycleType: string;
  status: string;
  startDate?: string;
  endDate?: string;
}

export interface StocktakingCycleCreatePayload {
  cycleName: string;
  cycleType: string;
}

export interface StocktakingTask {
  id: number;
  cycleId?: number;
  assetId?: number;
  locationId?: number;
  actualQuantity?: number;
  expectedQuantity?: number;
  variance?: number;
  status: string;
  photoUrl?: string;
}

export interface StocktakingCycleStats {
  totalCount: number;
  pendingCount: number;
  countedCount: number;
  adjustedCount: number;
  completedCount: number;
}

export interface StocktakingScanPayload {
  quantity: number;
  photoUrl?: string | null;
}

export interface StocktakingAdjustPayload {
  threshold?: number;
  reason?: string;
}

export const listStocktakingCycles = (status?: string) =>
  http.get<StocktakingCycle[]>('/stocktaking/cycles', {
    params: status ? { status } : undefined,
  });

export const createStocktakingCycle = (payload: StocktakingCycleCreatePayload) =>
  http.post<void>('/stocktaking/cycles', payload);

export const getStocktakingCycle = (id: number | string) =>
  http.get<StocktakingCycle>(`/stocktaking/cycles/${id}`);

export const getStocktakingCycleTasks = (id: number | string) =>
  http.get<StocktakingTask[]>(`/stocktaking/cycles/${id}/tasks`);

export const getStocktakingCycleStats = (id: number | string) =>
  http.get<StocktakingCycleStats>(`/stocktaking/cycles/${id}/stats`);

export const assignStocktakingTasks = (id: number | string) =>
  http.post<void>(`/stocktaking/cycles/${id}/assign`);

export const pauseStocktakingCycle = (id: number | string) =>
  http.post<void>(`/stocktaking/cycles/${id}/pause`);

export const resumeStocktakingCycle = (id: number | string) =>
  http.post<void>(`/stocktaking/cycles/${id}/resume`);

export const completeStocktakingCycle = (id: number | string) =>
  http.post<void>(`/stocktaking/cycles/${id}/complete`);

export const getStocktakingTask = (id: number | string) =>
  http.get<StocktakingTask>(`/stocktaking/tasks/${id}`);

export const scanStocktakingTask = (id: number | string, payload: StocktakingScanPayload) =>
  http.post<void>(`/stocktaking/tasks/${id}/scan`, payload);

export const adjustStocktakingTask = (id: number | string, payload: StocktakingAdjustPayload) =>
  http.post<void>(`/stocktaking/tasks/${id}/adjust`, payload);
