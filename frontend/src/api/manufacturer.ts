import http from '@/utils/http';

export interface Manufacturer {
  id?: number;
  name: string;
  code?: string;
  contact?: string;
  phone?: string;
  email?: string;
  website?: string;
  country?: string;
  address?: string;
  status?: number;
  remark?: string;
}

export const getManufacturers = (params?: Record<string, any>) =>
  http.get<any>('/manufacturers', { params });

export const getManufacturerOptions = () =>
  http.get<Manufacturer[]>('/manufacturers/options');

export const getManufacturerDetail = (id: number) =>
  http.get<Manufacturer>(`/manufacturers/${id}`);

export const createManufacturer = (data: Manufacturer) =>
  http.post<Manufacturer>('/manufacturers', data);

export const updateManufacturer = (id: number, data: Manufacturer) =>
  http.put<Manufacturer>(`/manufacturers/${id}`, data);

export const deleteManufacturer = (id: number) =>
  http.delete(`/manufacturers/${id}`);
