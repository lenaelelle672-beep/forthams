/**
 * 文件校验工具函数
 *
 * 对标 SPEC [SWARM-P2-006-FE] Layer 0.3
 * 提供 Excel 文件上传前的类型与大小校验能力。
 *
 * 约束：
 *   - 文件格式仅允许 .xlsx
 *   - 单文件大小上限 10MB（10,485,760 Bytes）
 */

/** 校验结果 */
export interface FileValidationResult {
  /** 是否通过校验 */
  valid: boolean;
  /** 未通过时的中文提示文案 */
  message?: string;
}

/** 文件大小上限：10 MB（字节） */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * 校验上传文件是否符合导入规范
 *
 * 校验顺序：文件存在性 → 文件格式（.xlsx）→ 文件大小（≤ 10MB）
 *
 * @param file - 浏览器 File 对象
 * @returns 校验结果 { valid, message }
 */
export function validateUploadFile(file: File | null | undefined): FileValidationResult {
  // 1. 文件存在性检查
  if (!file) {
    return { valid: false, message: '请选择要上传的文件' };
  }

  // 2. 文件格式校验 —— 以扩展名为主要判断依据
  //    不同浏览器对 .xlsx 的 MIME 报告不一致，
  //    因此以文件名后缀 .xlsx 作为权威判断标准
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.xlsx')) {
    return { valid: false, message: '仅支持 .xlsx 格式文件' };
  }

  // 3. 文件大小校验
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: '文件大小不能超过 10MB' };
  }

  return { valid: true };
}

export default validateUploadFile;