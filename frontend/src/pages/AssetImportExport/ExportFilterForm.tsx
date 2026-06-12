/**
 * ExportFilterForm – 导出条件筛选面板
 *
 * 提供按资产分类、状态、存放位置为维度的条件检索表单，
 * 触发导出接口请求，并通过 Blob + URL.createObjectURL 完成前端驱动的 Excel 下载。
 * 严格遵循 SPEC 约束：所有文件下载动作采用后端二进制流，前端通过 Blob 组装，
 * 利用 URL.createObjectURL 创建临时链接触发下载，并在组件卸载时释放内存。
 *
 * @module pages/AssetImportExport/ExportFilterForm
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import {
  AlertCircle,
  Download,
  RefreshCcw,
} from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { toast } from 'sonner';
import axios from 'axios';

/** Props for the ExportFilterForm component */
export interface ExportFilterFormProps {
  /** Callback invoked after a successful export download */
  onExportSuccess?: (filename: string) => void;
}

/** Asset category options available for filtering */
type AssetCategory = 'IT Equipment' | 'Furniture' | 'Vehicles' | 'Electronics' | 'Other';

/** Asset status options available for filtering */
type AssetStatus = 'active' | 'inactive' | 'maintenance' | 'retired' | 'disposed';

/** Asset location options available for filtering */
type LocationType = 'Warehouse A' | 'Office HQ' | 'Branch Office' | 'Remote Site' | 'Storage Facility';

/** Form values representing the export filter criteria */
export interface ExportFilters {
  category?: AssetCategory;
  status?: AssetStatus;
  location?: LocationType;
}

/**
 * ExportFilterForm component
 *
 * Renders a filter form allowing users to select asset category, status,
 * and location before triggering an Excel export download via Blob stream.
 * The download is fully frontend-driven using URL.createObjectURL, with
 * proper memory cleanup on unmount.
 */
export const ExportFilterForm: React.FC<ExportFilterFormProps> = ({ onExportSuccess }) => {
  /** Whether an export request is currently in flight */
  const [isExporting, setIsExporting] = useState(false);

  /** Error message displayed when export fails */
  const [error, setError] = useState<string | null>(null);

  /** Ref to track the current object URL for cleanup */
  const objectUrlRef = useRef<string | null>(null);

  const form = useForm<ExportFilters>({
    defaultValues: {
      category: undefined,
      status: undefined,
      location: undefined,
    },
  });

  /** Available category options for the filter dropdown */
  const categories: AssetCategory[] = [
    'IT Equipment',
    'Furniture',
    'Vehicles',
    'Electronics',
    'Other',
  ];

  /** Available status options for the filter dropdown */
  const statuses: AssetStatus[] = [
    'active',
    'inactive',
    'maintenance',
    'retired',
    'disposed',
  ];

  /** Available location options for the filter dropdown */
  const locations: LocationType[] = [
    'Warehouse A',
    'Office HQ',
    'Branch Office',
    'Remote Site',
    'Storage Facility',
  ];

  /**
   * Revoke the current object URL to free browser memory.
   * Safe to call multiple times — no-ops when no URL is held.
   */
  const revokeObjectUrl = useCallback((): void => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  /**
   * Cleanup effect: revoke any outstanding object URL on unmount
   * to prevent memory leaks per SPEC constraint.
   */
  useEffect(() => {
    return () => {
      revokeObjectUrl();
    };
  }, [revokeObjectUrl]);

  /**
   * Handle the export form submission.
   *
   * Collects the selected filter values, sends them as query parameters
   * to the export endpoint with `responseType: 'blob'`, then assembles
   * the response into a Blob and triggers a frontend-driven download
   * via URL.createObjectURL.
   *
   * @param values - The current form filter values
   */
  const handleExport = async (values: ExportFilters): Promise<void> => {
    setIsExporting(true);
    setError(null);

    try {
      // Build query parameters from non-empty filter values
      const params = new URLSearchParams();
      if (values.category) params.append('category', values.category);
      if (values.status) params.append('status', values.status);
      if (values.location) params.append('location', values.location);

      // Request binary stream from backend
      const response = await axios.get('/api/assets/export', {
        params,
        responseType: 'blob',
        timeout: 30000, // 30s timeout for large exports
      });

      // Handle empty response (204 No Content or empty blob)
      if (response.status === 204 || !response.data || response.data.size === 0) {
        throw new Error('No data found matching the selected filters');
      }

      // Assemble Blob from binary stream — SPEC: frontend-driven download
      const blob = new Blob(
        [response.data],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      );

      // Revoke any previous object URL before creating a new one
      revokeObjectUrl();

      // Create temporary object URL for download
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      // Trigger browser download via invisible anchor element
      const filename = `asset_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Delayed cleanup to ensure browser has initiated the download
      setTimeout(() => {
        if (objectUrlRef.current === url) {
          URL.revokeObjectURL(url);
          objectUrlRef.current = null;
        }
      }, 1000);

      toast.success('导出成功');
      onExportSuccess?.(filename);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Blob }; message?: string };
      console.error('Export failed:', err);

      // Attempt to read error message from Blob response
      let errorMessage: string;
      if (axiosErr.response?.data instanceof Blob) {
        errorMessage = await axiosErr.response.data.text();
      } else {
        errorMessage = axiosErr.message || 'Failed to export asset data';
      }

      setError(errorMessage);
      toast.error(`导出失败: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Reset all filter fields to their default (empty) state
   * and clear any displayed error messages.
   */
  const resetFilters = (): void => {
    form.reset();
    setError(null);
  };

  return (
    <Card data-testid="export-filter-form">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>导出资产台账</CardTitle>
            <p className="text-sm text-muted-foreground">
              筛选条件并导出资产数据到 Excel
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={resetFilters}
            disabled={isExporting}
            aria-label="重置筛选"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>导出失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleExport)}
            className="space-y-6"
            data-testid="export-filter-form-element"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Asset Category Filter */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem data-testid="filter-category">
                    <FormLabel>资产分类</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="所有分类" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* Asset Status Filter */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem data-testid="filter-status">
                    <FormLabel>状态</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="所有状态" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* Asset Location Filter */}
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem data-testid="filter-location">
                    <FormLabel>存放位置</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="所有位置" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  /** Clear all filters and reset form to defaults */
                  form.reset();
                  setError(null);
                }}
                disabled={isExporting}
              >
                清空筛选
              </Button>
              <Button
                type="submit"
                className="min-w-[140px] flex items-center gap-2"
                disabled={isExporting}
                data-testid="export-submit-btn"
              >
                {isExporting ? (
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {isExporting ? '导出中...' : '导出到 Excel'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default ExportFilterForm;
