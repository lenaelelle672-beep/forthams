import { http, HttpResponse, delay } from 'msw';

/**
 * Mock handlers for asset import/export functionality.
 * Conforms to [SWARM-P2-006-FE] specification.
 *
 * Endpoints covered:
 * - GET  /api/assets/import/template    — Download import template (.xlsx)
 * - POST /api/assets/import/parse       — Upload & parse Excel, return rows + errors
 * - POST /api/assets/import/commit      — Commit corrected rows for final import
 * - POST /api/assets/export             — Export assets as .xlsx based on filters
 * - GET  /api/categories/tree     — Category tree for export filter panel
 * - GET  /api/locations/cascade   — Location cascade for export filter panel
 */

// ─── Type Definitions ───────────────────────────────────────────────

/** Represents a single parsed asset row returned by the parse endpoint. */
interface AssetRow {
  rowNumber: number;
  name: string;
  categoryCode: string;
  statusCode: string;
  locationCode: string;
  purchaseDate: string;
  originalValue: number;
}

/** Represents a validation error for a specific cell in the parsed data. */
interface RowError {
  rowNumber: number;
  field: string;
  message: string;
}

// ─── Helper Functions ───────────────────────────────────────────────

/**
 * Create a minimal xlsx-like Blob for template / export downloads.
 * Uses a minimal ZIP header since .xlsx files are ZIP archives.
 */
const createExcelBlob = (): Blob => {
  const content = new Uint8Array([
    0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00,
  ]);
  return new Blob([content], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

/**
 * Format the current date/time as YYYYMMDD_HHmmss for export filenames.
 * Matches the spec requirement: 资产台账_YYYYMMDD_HHmmss.xlsx
 */
const formatTimestamp = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}` +
    `${pad(now.getMonth() + 1)}` +
    `${pad(now.getDate())}` +
    '_' +
    `${pad(now.getHours())}` +
    `${pad(now.getMinutes())}` +
    `${pad(now.getSeconds())}`
  );
};

// ─── Mock Data Constants ────────────────────────────────────────────

const CATEGORY_CODES = [
  'IT_EQUIPMENT',
  'OFFICE_SUPPLIES',
  'FURNITURE',
  'VEHICLES',
];

const STATUS_CODES = ['IN_USE', 'IDLE', 'MAINTENANCE', 'SCRAPPED'];

const LOCATION_CODES = [
  'HQ-FLOOR1-A',
  'HQ-FLOOR2-B',
  'BRANCH-A-FLOOR1',
  'WAREHOUSE-C',
];

/**
 * Generate a deterministic set of 50 mock parsed rows,
 * with exactly 5 rows carrying validation errors to satisfy
 * ATB-008 (50 rows, 5 errors) and ATB-009 (specific error display).
 *
 * @param total     - Total number of rows to generate (default 50).
 * @param errorRows - Row numbers that should carry validation errors.
 */
const generateParsedRows = (
  total: number = 50,
  errorRows: number[] = [3, 7, 12, 25, 38],
): { rows: AssetRow[]; errors: RowError[] } => {
  const rows: AssetRow[] = [];
  const errors: RowError[] = [];

  for (let i = 1; i <= total; i++) {
    const row: AssetRow = {
      rowNumber: i,
      name: `资产名称_${i}`,
      categoryCode: CATEGORY_CODES[(i - 1) % CATEGORY_CODES.length],
      statusCode: STATUS_CODES[(i - 1) % STATUS_CODES.length],
      locationCode: LOCATION_CODES[(i - 1) % LOCATION_CODES.length],
      purchaseDate: '2024-01-15',
      originalValue: Math.round((1000 + i * 500) * 100) / 100,
    };

    if (errorRows.includes(i)) {
      switch (i) {
        case 3:
          row.name = '';
          errors.push({
            rowNumber: i,
            field: 'name',
            message: '资产名称不能为空',
          });
          break;
        case 7:
          row.categoryCode = '';
          errors.push({
            rowNumber: i,
            field: 'categoryCode',
            message: '资产分类不能为空',
          });
          break;
        case 12:
          row.originalValue = -100;
          errors.push({
            rowNumber: i,
            field: 'originalValue',
            message: '原值必须大于0',
          });
          break;
        case 25:
          row.purchaseDate = 'invalid-date';
          errors.push({
            rowNumber: i,
            field: 'purchaseDate',
            message: '购置日期格式错误，应为YYYY-MM-DD',
          });
          break;
        case 38:
          row.statusCode = 'UNKNOWN';
          errors.push({
            rowNumber: i,
            field: 'statusCode',
            message: '不支持的资产状态',
          });
          break;
        default:
          break;
      }
    }

    rows.push(row);
  }

  return { rows, errors };
};

// ─── Category Tree Mock Data (for ExportPanel TreeSelect) ───────────

const categoryTree = [
  {
    title: '办公设备',
    value: 'OFFICE_EQUIPMENT',
    key: 'OFFICE_EQUIPMENT',
    children: [
      { title: '电脑', value: 'IT_EQUIPMENT', key: 'IT_EQUIPMENT' },
      { title: '打印机', value: 'PRINTER', key: 'PRINTER' },
      { title: '投影仪', value: 'PROJECTOR', key: 'PROJECTOR' },
    ],
  },
  {
    title: '办公家具',
    value: 'FURNITURE',
    key: 'FURNITURE',
    children: [
      { title: '桌椅', value: 'DESK_CHAIR', key: 'DESK_CHAIR' },
      { title: '柜子', value: 'CABINET', key: 'CABINET' },
    ],
  },
  {
    title: '交通工具',
    value: 'VEHICLES',
    key: 'VEHICLES',
    children: [{ title: '汽车', value: 'CAR', key: 'CAR' }],
  },
];

// ─── Location Cascade Mock Data (for ExportPanel Cascader) ──────────

const locationCascade = [
  {
    label: '北京市',
    value: 'BEIJING',
    children: [
      {
        label: '海淀区',
        value: 'HAIDIAN',
        children: [
          { label: '总部大楼', value: 'HQ' },
          { label: '科技园', value: 'TECH_PARK' },
        ],
      },
      {
        label: '朝阳区',
        value: 'CHAOYANG',
        children: [
          { label: 'CBD办公区', value: 'CBD_OFFICE' },
        ],
      },
    ],
  },
  {
    label: '上海市',
    value: 'SHANGHAI',
    children: [
      {
        label: '浦东新区',
        value: 'PUDONG',
        children: [
          { label: '张江园区', value: 'ZHANGJIANG' },
        ],
      },
    ],
  },
];

// ─── In-memory Parse State ──────────────────────────────────────────

/** Tracks the current parseId for the parse → commit flow. */
let currentParseId: string | null = null;

// ─── MSW Handlers ───────────────────────────────────────────────────

export const assetImportExportHandlers = [
  /**
   * GET /api/v1/assets/import/template
   * Download the Excel import template file.
   * ATB-002: Returns xlsx file with filename containing "asset_import_template".
   */
   http.get('/api/assets/import/template', async () => {
    await delay(500);
    const blob = createExcelBlob();
    return new HttpResponse(blob, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="asset_import_template.xlsx"',
      },
    });
  }),

  /**
   * POST /api/v1/assets/import/parse
   * Upload an .xlsx file and receive parsed rows with validation errors.
   * Response shape: { parseId: string, rows: AssetRow[], errors: RowError[] }
   * ATB-008: Returns 50 rows (5 with errors) for pagination testing.
   */
   http.post('/api/assets/import/parse', async ({ request }) => {
    await delay(1500);

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return HttpResponse.json(
        { success: false, message: '未找到上传文件' },
        { status: 400 },
      );
    }

    currentParseId = `parse_${Date.now()}`;
    const { rows, errors } = generateParsedRows(50, [3, 7, 12, 25, 38]);

    return HttpResponse.json({
      parseId: currentParseId,
      rows,
      errors,
    });
  }),

  /**
   * POST /api/v1/assets/import/commit
   * Commit the (possibly user-corrected) parsed rows for final import.
   * Request body:  { parseId: string, rows: AssetRow[] }
   * Response body: { success: boolean, importedCount: number, failedCount: number }
   * ATB-011: Shows success summary after commit.
   */
   http.post('/api/assets/import/commit', async ({ request }) => {
    await delay(1000);

    const body = (await request.json()) as {
      parseId: string;
      rows: AssetRow[];
    };

    if (!body.parseId || !Array.isArray(body.rows)) {
      return HttpResponse.json(
        { success: false, message: '请求参数无效' },
        { status: 400 },
      );
    }

    // Simulate commit: rows with remaining validation issues fail, rest succeed
    const failedCount = body.rows.filter(
      (r) =>
        !r.name ||
        !r.categoryCode ||
        !r.statusCode ||
        !r.locationCode ||
        !r.purchaseDate ||
        r.originalValue <= 0,
    ).length;
    const importedCount = body.rows.length - failedCount;

    return HttpResponse.json({
      success: true,
      importedCount,
      failedCount,
    });
  }),

  /**
   * POST /api/v1/assets/export
   * Export assets as an .xlsx file based on filter criteria.
   * Request body:  { categoryCodes: string[], statusCodes: string[], locationCodes: string[] }
   * Response:      Binary file stream (application/octet-stream)
   * ATB-016: Filename matches pattern 资产台账_YYYYMMDD_HHmmss.xlsx
   */
   http.post('/api/assets/export', async ({ request }) => {
    await delay(1200);

    // Validate request shape (filters are optional but body must parse)
    const _body = (await request.json()) as {
      categoryCodes?: string[];
      statusCodes?: string[];
      locationCodes?: string[];
    };

    // Generate export filename per spec: 资产台账_YYYYMMDD_HHmmss.xlsx
    const filename = `资产台账_${formatTimestamp()}.xlsx`;
    const blob = createExcelBlob();

    return new HttpResponse(blob, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  }),

  /**
   * GET /api/v1/asset-categories/tree
   * Return the asset category tree structure for the export filter panel.
   * ATB-014: TreeSelect data with hierarchical structure.
   */
   http.get('/api/categories/tree', async () => {
    await delay(300);
    return HttpResponse.json(categoryTree);
  }),

  /**
   * GET /api/v1/asset-locations/cascade
   * Return the location cascade data for the export filter panel.
   * ATB-014: Cascader data with province/city/district levels.
   */
   http.get('/api/locations/cascade', async () => {
    await delay(300);
    return HttpResponse.json(locationCascade);
  }),
];