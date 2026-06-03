import http from '@/utils/http';
import type {
  BpmMailConfig,
  BpmMailVariable,
  CreateBpmMailConfigRequest,
  UpdateBpmMailConfigRequest,
  CreateBpmMailVariableRequest,
  UpdateBpmMailVariableRequest,
} from '@/types/bpmMailConfig';

export const bpmMailConfigApi = {
  list(processType?: string) {
    return http.get<BpmMailConfig[]>('/bpm/mail-configs', { params: { processType } });
  },

  getById(id: number) {
    return http.get<BpmMailConfig>(`/bpm/mail-configs/${id}`);
  },

  create(data: CreateBpmMailConfigRequest) {
    return http.post<BpmMailConfig>('/bpm/mail-configs', data);
  },

  update(id: number, data: UpdateBpmMailConfigRequest) {
    return http.put<BpmMailConfig>(`/bpm/mail-configs/${id}`, data);
  },

  delete(id: number) {
    return http.delete<void>(`/bpm/mail-configs/${id}`);
  },

  listVariables() {
    return http.get<BpmMailVariable[]>('/bpm/mail-configs/variables');
  },

  createVariable(data: CreateBpmMailVariableRequest) {
    return http.post<BpmMailVariable>('/bpm/mail-configs/variables', data);
  },

  updateVariable(id: number, data: UpdateBpmMailVariableRequest) {
    return http.put<BpmMailVariable>(`/bpm/mail-configs/variables/${id}`, data);
  },

  deleteVariable(id: number) {
    return http.delete<void>(`/bpm/mail-configs/variables/${id}`);
  },
};
