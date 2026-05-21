import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Download,
  Upload,
  FileText,
  X,
  Table2,
  FileSpreadsheet,
  ArrowUpFromLine,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';

interface AssetRow {
  id: string;
  name: string;
  category: string;
  serialNumber: string;
  status: string;
  validation: 'success' | 'warning' | 'error';
}

const MOCK_PREVIEW: AssetRow[] = [
  { id: '1', name: '卡特彼勒 320 GC 挖掘机', category: '挖掘机械', serialNumber: 'CAT320-99823', status: '在用', validation: 'success' },
  { id: '2', name: '吉尼 Z-45/25J DC 高空作业平台', category: '高空作业设备', serialNumber: 'GENZ45-11022', status: '维修中', validation: 'warning' },
  { id: '3', name: '海斯特 H50XT 叉车', category: '叉车', serialNumber: 'INVALID_SN', status: '在用', validation: 'error' },
  { id: '4', name: '麦克 Granite GU813 自卸车', category: '自卸车', serialNumber: 'MACK-883921', status: '在途', validation: 'success' },
  { id: '5', name: '山猫 S76 滑移装载机', category: '滑移装载机', serialNumber: 'BOB-S76-4402', status: '在用', validation: 'success' },
];

const VALIDATION_STYLES = {
  success: { bg: '#dcfce7', text: '#16a34a', border: '#16a34a1a', label: '成功', Icon: CheckCircle },
  warning: { bg: '#fef3c7', text: '#d97706', border: '#d977061a', label: '警告', Icon: AlertTriangle },
  error: { bg: '#ffdad6', text: '#ba1a1a', border: '#ba1a1a1a', label: '错误', Icon: XCircle },
} as const;

const CATEGORY_OPTIONS = ['全部分类', '重型设备', '车辆', '工业工具'];
const STATUS_OPTIONS_EXPORT = ['全部状态', '在用', '维修中', '已退役'];

export default function AssetImportExportPage() {
  const [activeTab, setActiveTab] = useState('import');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [exportCategory, setExportCategory] = useState('');
  const [exportStatus, setExportStatus] = useState('');

  useQuery({
    queryKey: ['import-preview'],
    queryFn: async () => {
      return { data: MOCK_PREVIEW };
    },
    enabled: false,
  });

  const exportMutation = useMutation({
    mutationFn: async (filters: { categories: string[]; statuses: string[]; format: string }) => {
      const res = await fetch('/api/v1/assets/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });
      if (!res.ok) throw new Error('导出失败');
      return res.blob();
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) simulateUpload(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) simulateUpload(file);
  }, []);

  const simulateUpload = (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadedFile(file.name);
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => setIsUploading(false), 500);
      }
      setUploadProgress(Math.min(Math.round(progress), 100));
    }, 300);
  };

  const handleCancelUpload = () => {
    setIsUploading(false);
    setUploadProgress(0);
    setUploadedFile(null);
  };

  const handleExport = () => {
    exportMutation.mutate({
      categories: exportCategory && exportCategory !== '全部分类' ? [exportCategory] : [],
      statuses: exportStatus && exportStatus !== '全部状态' ? [exportStatus] : [],
      format: exportFormat,
    });
  };

  return (
    <div className="min-h-screen bg-[#f9f9ff]">
      <PageHeader
        title="资产导入导出"
        breadcrumbs={[{ label: '资产管理' }, { label: '导入导出' }]}
        actions={
          <Button variant="primary" size="md">
            创建请求
          </Button>
        }
      />

      <div className="px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="import">导入资产</TabsTrigger>
            <TabsTrigger value="export">导出资产</TabsTrigger>
          </TabsList>

          <TabsContent value="import">
            <div className="space-y-6 max-w-[1200px] mx-auto">
              <div className="flex justify-end">
                <Button variant="outline" size="md">
                  <Download className="w-4 h-4" />
                  下载 Excel 模板
                </Button>
              </div>

              <div
                className={`bg-white p-12 rounded-xl flex flex-col items-center justify-center text-center space-y-4 group cursor-pointer transition-all ${
                  isDragging ? 'bg-[#f1f3ff] border-[#004191]' : ''
                }`}
                style={{
                  backgroundImage: !isDragging
                    ? "url(\"data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' stroke='%23004191' stroke-width='2' stroke-dasharray='8%2c 8' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e\")"
                    : undefined,
                  border: isDragging ? '2px solid #004191' : undefined,
                }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept=".xlsx,.csv,.xml" className="hidden" onChange={handleFileSelect} />
                <div className="w-16 h-16 bg-[#d8e2ff] rounded-full flex items-center justify-center text-[#004191] group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-base font-semibold text-[#161c27]">拖拽文件到此处或点击浏览</p>
                  <p className="text-xs text-[#424753] mt-1">支持 XLSX、CSV 和 XML 格式（最大 50MB）</p>
                </div>
              </div>

              {uploadedFile && (
                <div className="bg-white p-4 rounded-xl border border-[#e5e7eb] flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#e3e8f8] rounded flex items-center justify-center">
                    <FileText className="w-5 h-5 text-[#004191]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-[#161c27]">{uploadedFile}</span>
                      <span className="text-sm font-semibold text-[#004191]">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-[#dee2f2] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#004191] h-full rounded-full transition-all duration-500"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                  <button className="p-2 text-[#424753] hover:text-[#ba1a1a] transition-colors" onClick={handleCancelUpload}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              <Card>
                <div className="px-4 py-4 border-b border-[#e5e7eb] flex justify-between items-center">
                  <h3 className="text-base font-semibold text-[#161c27]">数据校验预览</h3>
                  <div className="flex gap-2">
                    <span className="text-xs text-[#424753] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#16a34a]" /> 1,240 条有效
                    </span>
                    <span className="text-xs text-[#424753] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#d97706]" /> 12 条警告
                    </span>
                    <span className="text-xs text-[#424753] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#ba1a1a]" /> 3 条错误
                    </span>
                  </div>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#f1f3ff]">
                    <tr>
                      {['资产名称', '分类', '序列号', '状态', '校验'].map((h) => (
                        <th key={h} className="px-4 py-3 text-[10px] font-semibold text-[#424753] uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb]">
                    {MOCK_PREVIEW.map((row) => {
                      const v = VALIDATION_STYLES[row.validation];
                      const VIcon = v.Icon;
                      return (
                        <tr key={row.id} className="hover:bg-[#f1f3ff] transition-colors">
                          <td className="px-4 py-4 text-sm font-semibold text-[#161c27]">{row.name}</td>
                          <td className="px-4 py-4 text-sm text-[#161c27]">{row.category}</td>
                          <td className={`px-4 py-4 text-xs font-mono ${row.validation === 'error' ? 'text-[#ba1a1a]' : 'text-[#424753]'}`}>
                            {row.serialNumber}
                          </td>
                          <td className="px-4 py-4 text-sm text-[#161c27]">{row.status}</td>
                          <td className="px-4 py-4">
                            <span
                              className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full inline-flex items-center gap-1"
                              style={{ background: v.bg, color: v.text, border: `1px solid ${v.border}` }}
                            >
                              <VIcon className="w-3 h-3" />
                              {v.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="export">
            <div className="space-y-6 max-w-[800px] mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 space-y-4">
                  <h3 className="text-base font-semibold text-[#161c27]">数据筛选</h3>
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-[#424753] uppercase tracking-wider">
                      资产分类
                    </label>
                    <div className="space-y-2">
                      {CATEGORY_OPTIONS.map((cat) => (
                        <label key={cat} className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={exportCategory === cat || (!exportCategory && cat === '全部分类')}
                            onChange={() => setExportCategory(cat)}
                            className="w-4 h-4 rounded border-[#727784] text-[#004191] focus:ring-[#004191]"
                          />
                          <span className="text-sm group-hover:text-[#004191] transition-colors">{cat}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-[#424753] uppercase tracking-wider">
                      资产状态
                    </label>
                    <select
                      value={exportStatus}
                      onChange={(e) => setExportStatus(e.target.value)}
                      className="w-full bg-[#f1f3ff] border-0 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#004191]/20 appearance-none"
                    >
                      {STATUS_OPTIONS_EXPORT.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </Card>

                <Card className="p-6 space-y-6 flex flex-col">
                  <h3 className="text-base font-semibold text-[#161c27]">导出配置</h3>
                  <div className="space-y-4 flex-1">
                    <label className="block text-xs font-semibold text-[#424753] uppercase tracking-wider">
                      文件格式
                    </label>
                    <div className="flex gap-4">
                      {([
                        { value: 'xlsx' as const, label: 'XLSX', Icon: Table2 },
                        { value: 'csv' as const, label: 'CSV', Icon: FileSpreadsheet },
                      ]).map(({ value, label, Icon }) => (
                        <label
                          key={value}
                          className={`flex-1 flex items-center justify-center gap-3 p-4 border rounded-xl cursor-pointer hover:border-[#004191] transition-all ${
                            exportFormat === value ? 'bg-[#d8e2ff] border-[#004191]' : 'border-[#e5e7eb]'
                          }`}
                        >
                          <input
                            type="radio"
                            name="format"
                            value={value}
                            checked={exportFormat === value}
                            onChange={() => setExportFormat(value)}
                            className="hidden"
                          />
                          <Icon className="w-5 h-5 text-[#004191]" />
                          <span className="text-sm font-semibold text-[#161c27]">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full !py-4 !rounded-xl !font-bold !text-base"
                    loading={exportMutation.isPending}
                    onClick={handleExport}
                  >
                    <ArrowUpFromLine className="w-5 h-5" />
                    导出数据
                  </Button>
                </Card>
              </div>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-[#161c27]">导出摘要</h3>
                  <span className="text-xs text-[#424753]">预览 2,450 条记录</span>
                </div>
                <div className="relative h-48 w-full bg-[#f1f3ff] rounded-lg flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 flex items-end justify-between px-12 pb-6 gap-4">
                    {[60, 85, 45, 70, 55].map((h, i) => (
                      <div
                        key={i}
                        className={`w-16 rounded-t-lg transition-all duration-1000 ${i % 2 === 0 ? 'bg-[#004191]' : 'bg-[#0058be]'}`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#f1f3ff] to-transparent pointer-events-none opacity-50" />
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
