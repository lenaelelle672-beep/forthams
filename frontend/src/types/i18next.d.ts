// i18next / react-i18next 类型覆盖
// 解决 "Expected 1 arguments, but got 2" 错误
// 允许在 t(key, options) 中传递插值参数

import 'react-i18next';

declare module 'react-i18next' {
  interface UseTranslationResponse {
    t(key: string, options?: Record<string, unknown>): string;
  }
}

declare module 'i18next' {
  interface TFunction {
    (key: string, options?: Record<string, unknown>): string;
    (key: string, defaultValue?: string, options?: Record<string, unknown>): string;
  }
}
