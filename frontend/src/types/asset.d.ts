export interface Asset {
  id: number;
  assetCode: string;
  name: string;
  category: string;
  status: 'active' | 'maintenance' | 'retired' | 'idle';
  location: string;
  department: string;
  purchaseDate: string;
  value: number;
}

export interface AssetQueryParams {
  page?: number;
  size?: number;
  keyword?: string;
  category?: string;
  status?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  size: number;
}