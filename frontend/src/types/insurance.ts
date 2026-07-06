export enum InsuranceTypeEnum {
  PROPERTY = 'PROPERTY',
  LIABILITY = 'LIABILITY',
  VEHICLE = 'VEHICLE'
}

export enum InsuranceStatusEnum {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED'
}

export enum ClaimStatusEnum {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface Insurance {
  id?: number;
  policyNo: string;
  insuranceName: string;
  insuranceType: InsuranceTypeEnum;
  assetIds: string;
  assetIdList?: number[];
  insurer: string;
  premium: number;
  coverage?: number;
  deductible?: number;
  startDate: string;
  endDate: string;
  status: InsuranceStatusEnum;
  remark?: string;
  tenantId?: string;
  createBy?: number;
  createTime?: string;
  updateTime?: string;
  deleted?: number;
}

export interface InsuranceClaim {
  id?: number;
  claimNo: string;
  insuranceId: number;
  claimDate: string;
  incidentDescription?: string;
  claimAmount: number;
  settledAmount?: number;
  status: ClaimStatusEnum;
  settleDate?: string;
  remark?: string;
  policyNo?: string;
  insuranceName?: string;
  tenantId?: string;
  createBy?: number;
  createTime?: string;
  updateTime?: string;
  deleted?: number;
}

export interface InsuranceQueryParams {
  keyword?: string;
  insuranceType?: InsuranceTypeEnum;
  status?: InsuranceStatusEnum;
  startDate?: string;
  endDate?: string;
  pageNum?: number;
  pageSize?: number;
}