package com.assetmanage.constant;

/**
 * 资产批量导入导出相关常量定义。
 * <p>
 * 遵循 SWARM-P2-006-BE 规格约束：
 * 仅支持 .xlsx 格式，单文件上限 5MB，单次最大 5000 行数据（不含表头）。
 * </p>
 */
public final class AssetImportConstants {

    private AssetImportConstants() {
        // 禁止实例化
    }

    // ==================== 文件约束配置 ====================

    /** 允许的文件扩展名（仅限 .xlsx） */
    public static final String ALLOWED_EXTENSION = ".xlsx";

    /** 允许的 MIME Content-Type */
    public static final String ALLOWED_CONTENT_TYPE =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    /** 单次上传文件大小上限：5MB */
    public static final long MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024L;

    /** 单次导入最大行数限制（不含表头） */
    public static final int MAX_IMPORT_ROWS = 5000;

    /** 模板文件下载时的默认文件名 */
    public static final String TEMPLATE_FILENAME = "asset_import_template.xlsx";

    /** 模板 Sheet 名称 */
    public static final String TEMPLATE_SHEET_NAME = "资产导入模板";

    /** 日期格式校验模式（采购日期列） */
    public static final String DATE_FORMAT_PATTERN = "yyyy-MM-dd";

    // ==================== Excel 列索引定义 ====================

    /** 资产编号 */
    public static final int COL_ASSET_CODE = 0;
    /** 资产名称 */
    public static final int COL_ASSET_NAME = 1;
    /** 分类 */
    public static final int COL_CATEGORY = 2;
    /** 状态 */
    public static final int COL_STATUS = 3;
    /** 位置 */
    public static final int COL_LOCATION = 4;
    /** 采购日期 */
    public static final int COL_PURCHASE_DATE = 5;
    /** 价值/价格 */
    public static final int COL_PRICE = 6;
    /** 使用人 */
    public static final int COL_OWNER = 7;
    /** 所属部门 */
    public static final int COL_DEPARTMENT = 8;
    /** 备注 */
    public static final int COL_REMARK = 9;

    /** 总列数 */
    public static final int TOTAL_COLUMNS = 10;

    /** Excel 列头名称定义（用于模板生成与校验） */
    public static final String[] COLUMN_HEADERS = {
        "资产编号", "资产名称", "分类", "状态", "位置",
        "采购日期(yyyy-MM-dd)", "价值/价格", "使用人", "所属部门", "备注"
    };

    /** 必填字段对应的列索引（资产编号、资产名称、分类、状态） */
    public static final int[] REQUIRED_COLUMNS = {
        COL_ASSET_CODE, COL_ASSET_NAME, COL_CATEGORY, COL_STATUS
    };

    // ==================== 有效枚举值（用于下拉框与校验） ====================

    /** 有效资产状态（用于 Excel 下拉框及枚举校验） */
    public static final String[] VALID_STATUSES = {
        "在用", "维修中", "报废", "库存", "闲置"
    };

    /** 默认资产分类（示例值，实际应从数据库/字典动态加载） */
    public static final String[] DEFAULT_CATEGORIES = {
        "电子设备", "办公家具", "交通工具", "机械设备", "其他"
    };

    // ==================== 数值边界 ====================

    /** 价格字段下限（>= 0） */
    public static final double PRICE_MIN_VALUE = 0.0;

    /** 价格字段上限（<= 99,999,999.99） */
    public static final double PRICE_MAX_VALUE = 99_999_999.99;

    // ==================== 校验错误消息模板 ====================

    /** 文件格式错误 */
    public static final String ERR_FILE_FORMAT = "仅支持 .xlsx 格式的 Excel 文件";
    /** 文件大小超限 */
    public static final String ERR_FILE_TOO_LARGE = "文件大小超过 5MB 限制";
    /** 行数超限 */
    public static final String ERR_ROW_COUNT_EXCEEDED = "导入行数不能超过 5000 行";
    /** 必填字段为空（参数：字段名） */
    public static final String ERR_EMPTY_CELL = "%s 不能为空";
    /** 日期格式错误 */
    public static final String ERR_INVALID_DATE_FORMAT = "日期格式不正确，应为 yyyy-MM-dd";
    /** 枚举/字典值无效（参数：字段名、实际值） */
    public static final String ERR_INVALID_ENUM = "%s 值无效: %s";
    /** 数值格式错误（参数：字段名） */
    public static final String ERR_NUMERIC_VALUE = "%s 必须是有效的数值";
    /** 数值越界（参数：字段名） */
    public static final String ERR_NUMERIC_OUT_OF_RANGE = "%s 数值超出有效范围";
    /** 行号越界 */
    public static final String ERR_ROW_OUT_OF_RANGE = "Excel 行号超出有效范围";
    /** 列头不匹配 */
    public static final String ERR_COLUMN_MISMATCH = "列头信息不匹配，请使用标准模板";
    /** 上传文件为空 */
    public static final String ERR_FILE_EMPTY = "上传文件为空";
    /** 文件解析失败 */
    public static final String ERR_FILE_PARSE_FAILED = "文件解析失败，请检查文件是否损坏";
}