/**
 * @file utils/auth.ts
 * @description Auth storage constants and utilities (migrated from app/utils/api)
 */

export const TOKEN_STORAGE_KEY = "auth_token";
export const USER_STORAGE_KEY = "user_info";

export function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
         window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function clearAuthStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(USER_STORAGE_KEY);
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
}
