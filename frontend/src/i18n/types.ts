/**
 * i18n 类型声明 — 确保 t() 调用有类型安全。
 * 使用 react-i18next 的 CustomTypeOptions 扩展默认资源类型。
 */
import 'i18next';

// 在此声明所有 namespace 及其键值结构
// 格式：declare module 'i18next' {
//   interface CustomTypeOptions {
//     resources: {
//       common: typeof import('./locales/zh-CN/common').default;
//       workorder: typeof import('./locales/zh-CN/workorder').default;
//       inventory: typeof import('./locales/zh-CN/inventory').default;
//       asset: typeof import('./locales/zh-CN/asset').default;
//       approval: typeof import('./locales/zh-CN/approval').default;
//       user: typeof import('./locales/zh-CN/user').default;
//     };
//   }
// }

export {};
