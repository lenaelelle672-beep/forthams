/**
 * i18n 初始化配置。
 *
 * - 使用 i18next 作为核心，react-i18next 作为 React 绑定
 * - 默认语言：zh-CN
 * - 后备语言：zh-CN（英文翻译未完成时显示中文）
 * - 通过 namespace 隔离模块文案
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// ── 通用文案 ──
import commonZhCN from './locales/zh-CN/common';
import commonEn from './locales/en/common';

// ── 5 个核心模块 ──
import workorderZhCN from './locales/zh-CN/workorder';
import inventoryZhCN from './locales/zh-CN/inventory';
import assetZhCN from './locales/zh-CN/asset';
import approvalZhCN from './locales/zh-CN/approval';
import userZhCN from './locales/zh-CN/user';
import analyticsZhCN from './locales/zh-CN/analytics';

// 英文翻译（阶段 1：复用中文或 key）
import workorderEn from './locales/en/workorder';
import inventoryEn from './locales/en/inventory';
import assetEn from './locales/en/asset';
import approvalEn from './locales/en/approval';
import userEn from './locales/en/user';
import analyticsEn from './locales/en/analytics';

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': {
      common: commonZhCN,
      workorder: workorderZhCN,
      inventory: inventoryZhCN,
      asset: assetZhCN,
      approval: approvalZhCN,
      user: userZhCN,
      analytics: analyticsZhCN,
    },
    en: {
      common: commonEn,
      workorder: workorderEn,
      inventory: inventoryEn,
      asset: assetEn,
      approval: approvalEn,
      user: userEn,
      analytics: analyticsEn,
    },
  },
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  ns: ['common', 'workorder', 'inventory', 'asset', 'approval', 'user', 'analytics'],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false, // React 已处理 XSS
  },
  detection: {
    // 后续可集成 i18next-browser-languageDetector
    order: ['localStorage', 'navigator', 'htmlTag'],
  },
});

export default i18n;
