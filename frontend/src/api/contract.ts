import http from '@/utils/http';

export interface Contract {
  id?: number;
  contractNo?: string;
  contractName: string;
  contractType: string;
  vendorId?: number;
  assetId?: number;
  amount?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  autoRenew?: number;
  renewDays?: number;
  fileUrl?: string;
  remark?: string;
}

export const getContracts = (params?: Record<string, any>) =>
  http.get<any>('/contracts', { params });

export const getExpiringContracts = (days = 30) =>
  http.get<Contract[]>('/contracts/expiring', { params: { days } });

export const getContractDetail = (id: number) =>
  http.get<Contract>(`/contracts/${id}`);

export const createContract = (data: Contract) =>
  http.post<Contract>('/contracts', data);

export const updateContract = (id: number, data: Contract) =>
  http.put<Contract>(`/contracts/${id}`, data);

export const deleteContract = (id: number) =>
  http.delete(`/contracts/${id}`);
