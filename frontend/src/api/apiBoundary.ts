/**
 * 已由 http 响应拦截器解包的业务响应仍然是运行时 unknown。
 * API 模块必须在这里的边界完成校验，不能把 Axios 泛型当作后端契约。
 */
export type ApiRecord = Record<string, unknown>;

export async function decodeUnwrappedResponse<T>(
  request: Promise<unknown>,
  label: string,
  decoder: (value: unknown, label: string) => T,
): Promise<T> {
  return decoder(await request, label);
}

export function isApiRecord(value: unknown): value is ApiRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function requireApiRecord(value: unknown, label: string): ApiRecord {
  if (!isApiRecord(value)) {
    throw new Error(`${label}响应格式无效`);
  }
  return value;
}

export function requireApiArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label}响应格式无效`);
  }
  return value;
}

export function requireString(record: ApiRecord, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`${label}响应中的${key}无效`);
  }
  return value;
}

export function requireNonBlankString(record: ApiRecord, key: string, label: string): string {
  const value = requireString(record, key, label);
  if (!value.trim()) {
    throw new Error(`${label}响应中的${key}无效`);
  }
  return value;
}

export function readOptionalString(record: ApiRecord, key: string, label: string): string | undefined {
  const value = record[key];
  if (value == null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`${label}响应中的${key}无效`);
  }
  return value;
}

export function readNullableString(record: ApiRecord, key: string, label: string): string | null {
  const value = record[key];
  if (value == null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`${label}响应中的${key}无效`);
  }
  return value;
}

export function requireBoolean(record: ApiRecord, key: string, label: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new Error(`${label}响应中的${key}无效`);
  }
  return value;
}

export function requireNonNegativeInteger(record: ApiRecord, key: string, label: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}响应中的${key}无效`);
  }
  return value;
}

export function requirePositiveInteger(record: ApiRecord, key: string, label: string): number {
  const value = requireNonNegativeInteger(record, key, label);
  if (value <= 0) {
    throw new Error(`${label}响应中的${key}无效`);
  }
  return value;
}

export function readOptionalPositiveInteger(record: ApiRecord, key: string, label: string): number | undefined {
  if (record[key] == null) {
    return undefined;
  }
  return requirePositiveInteger(record, key, label);
}

export function readOptionalNonNegativeInteger(record: ApiRecord, key: string, label: string): number | undefined {
  if (record[key] == null) {
    return undefined;
  }
  return requireNonNegativeInteger(record, key, label);
}

export function readNullableNonNegativeInteger(record: ApiRecord, key: string, label: string): number | null {
  if (record[key] == null) {
    return null;
  }
  return requireNonNegativeInteger(record, key, label);
}

export function readNullableApiRecord(record: ApiRecord, key: string, label: string): ApiRecord | null {
  const value = record[key];
  if (value == null) {
    return null;
  }
  return requireApiRecord(value, `${label}响应中的${key}`);
}

export function getStoredOperatorId(): number | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const raw = window.sessionStorage.getItem('user_info') || window.localStorage.getItem('user_info');
  if (!raw) {
    return undefined;
  }

  try {
    const user: unknown = JSON.parse(raw);
    if (!isApiRecord(user)) {
      return undefined;
    }
    const id = user.id ?? user.userId ?? user.uid;
    const numericId = typeof id === 'number' || typeof id === 'string' ? Number(id) : Number.NaN;
    return Number.isSafeInteger(numericId) && numericId > 0 ? numericId : undefined;
  } catch {
    return undefined;
  }
}
