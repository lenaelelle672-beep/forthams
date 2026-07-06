/**
 * 中文（简体）国际化文案统一入口
 *
 * 聚合导出各模块 locale 文件，便于按需引入。
 */
import assetLocale from './asset';
import workorderLocale from './workorder';
import approvalLocale from './approval';
import systemLocale from './system';
import inventoryLocale from './inventory';

const zhCNLocales = {
  asset: assetLocale,
  workorder: workorderLocale,
  approval: approvalLocale,
  system: systemLocale,
  inventory: inventoryLocale,
};

export default zhCNLocales;
export { assetLocale, workorderLocale, approvalLocale, systemLocale, inventoryLocale };
