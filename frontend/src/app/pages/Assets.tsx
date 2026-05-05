@@ import statements and type definitions
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import assetService, { AssetResponse, AssetCreateDTO, AssetUpdateDTO } from '@/services/assetService';

 interface AssetFormData {
   assetCode: string;
   assetName: string;
   categoryId: number | null;
   locationId: number | null;
   purchaseDate: string;
   purchasePrice: number | null;
   status: string;
 }

 interface AssetFormErrors {
   assetCode?: string;
   assetName?: string;
   categoryId?: string;
   locationId?: string;
 }

 const initialFormData: AssetFormData = {
   assetCode: '',
   assetName: '',
   categoryId: null,
   locationId: null,
   purchaseDate: '',
   purchasePrice: null,
   status: 'ACTIVE'
 };

 function AssetsPage() {
   const { canWrite } = useAuth();
   const [assets, setAssets] = useState<AssetResponse[]>([]);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
   const [editingAsset, setEditingAsset] = useState<AssetResponse | null>(null);
   const [deletingAsset, setDeletingAsset] = useState<AssetResponse | null>(null);
   const [formData, setFormData] = useState<AssetFormData>(initialFormData);
   const [formErrors, setFormErrors] = useState<AssetFormErrors>({});
   const [searchKeyword, setSearchKeyword] = useState('');

   const fetchAssets = useCallback(async () => {
     setLoading(true);
     setError(null);
     try {
       const data = await assetService.findAll();
       setAssets(data);
     } catch (err) {
       setError(err instanceof Error ? err.message : '获取资产列表失败');
     } finally {
       setLoading(false);
     }
   }, []);

   useEffect(() => {
     fetchAssets();
   }, [fetchAssets]);

   const validateForm = (): boolean => {
     const errors: AssetFormErrors = {};
     if (!formData.assetCode.trim()) {
       errors.assetCode = '资产编号不能为空';
     }
     if (!formData.assetName.trim()) {
       errors.assetName = '资产名称不能为空';
     }
     setFormErrors(errors);
     return Object.keys(errors).length === 0;
   };

   const handleOpenCreate = () => {
     setEditingAsset(null);
     setFormData(initialFormData);
     setFormErrors({});
     setIsModalOpen(true);
   };

   const handleOpenEdit = (asset: AssetResponse) => {
     setEditingAsset(asset);
     setFormData({
       assetCode: asset.assetCode || '',
       assetName: asset.assetName || '',
       categoryId: asset.categoryId || null,
       locationId: asset.locationId || null,
       purchaseDate: asset.purchaseDate || '',
       purchasePrice: asset.purchasePrice || null,
       status: asset.status || 'ACTIVE'
     });
     setFormErrors({});
     setIsModalOpen(true);
   };

   const handleCloseModal = () => {
     setIsModalOpen(false);
     setEditingAsset(null);
     setFormData(initialFormData);
     setFormErrors({});
   };

   const handleInputChange = (field: keyof AssetFormData, value: string | number | null) => {
     setFormData(prev => ({ ...prev, [field]: value }));
     if (formErrors[field as keyof AssetFormErrors]) {
       setFormErrors(prev => ({ ...prev, [field]: undefined }));
     }
   };

   const handleSubmit = async () => {
     if (!validateForm()) return;
     try {
       if (editingAsset) {
         const updateData: AssetUpdateDTO = {
           assetName: formData.assetName,
           categoryId: formData.categoryId,
           locationId: formData.locationId,
           purchaseDate: formData.purchaseDate,
           purchasePrice: formData.purchasePrice,
           status: formData.status
         };
         await assetService.update(editingAsset.id, updateData);
       } else {
         const createData: AssetCreateDTO = {
           assetCode: formData.assetCode,
           assetName: formData.assetName,
           categoryId: formData.categoryId,
           locationId: formData.locationId,
           purchaseDate: formData.purchaseDate,
           purchasePrice: formData.purchasePrice,
           status: formData.status
         };
         await assetService.insert(createData);
       }
       handleCloseModal();
       fetchAssets();
     } catch (err) {
       setError(err instanceof Error ? err.message : '操作失败');
     }
   };

   const handleOpenDelete = (asset: AssetResponse) => {
     setDeletingAsset(asset);
     setIsDeleteDialogOpen(true);
   };

   const handleCloseDeleteDialog = () => {
     setIsDeleteDialogOpen(false);
     setDeletingAsset(null);
   };

   const handleConfirmDelete = async () => {
     if (!deletingAsset) return;
     try {
       await assetService.delete(deletingAsset.id);
       handleCloseDeleteDialog();
       fetchAssets();
     } catch (err) {
       setError(err instanceof Error ? err.message : '删除失败');
     }
   };

   const filteredAssets = assets.filter(asset => {
     if (!searchKeyword) return true;
     const keyword = searchKeyword.toLowerCase();
     return (
       asset.assetCode?.toLowerCase().includes(keyword) ||
       asset.assetName?.toLowerCase().includes(keyword)
     );
   });

   const getStatusBadge = (status: string | undefined) => {
     const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
       ACTIVE: { label: '在用', variant: 'default' },
       IDLE: { label: '闲置', variant: 'secondary' },
       MAINTENANCE: { label: '维保中', variant: 'outline' },
       SCRAPPED: { label: '已报废', variant: 'destructive' }
     };
     const config = statusMap[status || 'ACTIVE'] || { label: status, variant: 'secondary' };
     return <Badge variant={config.variant}>{config.label}</Badge>;
   };

   return (
     <div className="container mx-auto p-6 space-y-6">
       <div className="flex items-center justify-between">
         <h1 className="text-3xl font-bold">资产管理</h1>
         {canWrite && (
           <Button onClick={handleOpenCreate}>
             新增资产
           </Button>
         )}
       </div>

       <Card>
         <CardHeader>
           <div className="flex items-center gap-4">
             <Input
               placeholder="搜索资产编号或名称..."
               value={searchKeyword}
               onChange={(e) => setSearchKeyword(e.target.value)}
               className="max-w-xs"
             />
           </div>
         </CardHeader>
         <CardContent>
           {loading && <div className="text-center py-8">加载中...</div>}
           {error && <div className="text-red-500 text-center py-4">{error}</div>}
           {!loading && !error && (
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>资产编号</TableHead>
                   <TableHead>资产名称</TableHead>
                   <TableHead>分类</TableHead>
                   <TableHead>位置</TableHead>
                   <TableHead>购置日期</TableHead>
                   <TableHead>购置价格</TableHead>
                   <TableHead>状态</TableHead>
                   {canWrite && <TableHead className="text-right">操作</TableHead>}
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {filteredAssets.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={canWrite ? 8 : 7} className="text-center py-8">
                       暂无数据
                     </TableCell>
                   </TableRow>
                 ) : (
                   filteredAssets.map((asset) => (
                     <TableRow key={asset.id}>
                       <TableCell>{asset.assetCode || '-'}</TableCell>
                       <TableCell>{asset.assetName || '-'}</TableCell>
                       <TableCell>{asset.categoryName || '-'}</TableCell>
                       <TableCell>{asset.locationName || '-'}</TableCell>
                       <TableCell>{asset.purchaseDate || '-'}</TableCell>
                       <TableCell>{asset.purchasePrice != null ? `¥${asset.purchasePrice.toLocaleString()}` : '-'}</TableCell>
                       <TableCell>{getStatusBadge(asset.status)}</TableCell>
                       {canWrite && (
                         <TableCell className="text-right">
                           <div className="flex justify-end gap-2">
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => handleOpenEdit(asset)}
                             >
                               编辑
                             </Button>
                             <Button
                               variant="destructive"
                               size="sm"
                               onClick={() => handleOpenDelete(asset)}
                             >
                               删除
                             </Button>
                           </div>
                         </TableCell>
                       )}
                     </TableRow>
                   ))
                 )}
               </TableBody>
             </Table>
           )}
         </CardContent>
       </Card>

       <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
         <DialogContent className="max-w-lg">
           <DialogHeader>
             <DialogTitle>{editingAsset ? '编辑资产' : '新增资产'}</DialogTitle>
             <DialogDescription>
               {editingAsset ? '修改资产信息' : '填写资产信息'}
             </DialogDescription>
           </DialogHeader>
           <div className="grid gap-4 py-4">
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label htmlFor="assetCode">资产编号 *</Label>
                 <Input
                   id="assetCode"
                   value={formData.assetCode}
                   onChange={(e) => handleInputChange('assetCode', e.target.value)}
                   disabled={!!editingAsset}
                   placeholder="请输入资产编号"
                 />
                 {formErrors.assetCode && (
                   <span className="text-red-500 text-sm">{formErrors.assetCode}</span>
                 )}
               </div>
               <div className="space-y-2">
                 <Label htmlFor="assetName">资产名称 *</Label>
                 <Input
                   id="assetName"
                   value={formData.assetName}
                   onChange={(e) => handleInputChange('assetName', e.target.value)}
                   placeholder="请输入资产名称"
                 />
                 {formErrors.assetName && (
                   <span className="text-red-500 text-sm">{formErrors.assetName}</span>
                 )}
               </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label htmlFor="categoryId">资产分类</Label>
                 <Input
                   id="categoryId"
                   type="number"
                   value={formData.categoryId ?? ''}
                   onChange={(e) => handleInputChange('categoryId', e.target.value ? Number(e.target.value) : null)}
                   placeholder="分类ID"
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="locationId">存放位置</Label>
                 <Input
                   id="locationId"
                   type="number"
                   value={formData.locationId ?? ''}
                   onChange={(e) => handleInputChange('locationId', e.target.value ? Number(e.target.value) : null)}
                   placeholder="位置ID"
                 />
               </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label htmlFor="purchaseDate">购置日期</Label>
                 <Input
                   id="purchaseDate"
                   type="date"
                   value={formData.purchaseDate}
                   onChange={(e) => handleInputChange('purchaseDate', e.target.value)}
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="purchasePrice">购置价格</Label>
                 <Input
                   id="purchasePrice"
                   type="number"
                   step="0.01"
                   value={formData.purchasePrice ?? ''}
                   onChange={(e) => handleInputChange('purchasePrice', e.target.value ? Number(e.target.value) : null)}
                   placeholder="0.00"
                 />
               </div>
             </div>
             <div className="space-y-2">
               <Label htmlFor="status">资产状态</Label>
               <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                 <SelectTrigger id="status">
                   <SelectValue placeholder="选择状态" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="ACTIVE">在用</SelectItem>
                   <SelectItem value="IDLE">闲置</SelectItem>
                   <SelectItem value="MAINTENANCE">维保中</SelectItem>
                   <SelectItem value="SCRAPPED">已报废</SelectItem>
                 </SelectContent>
               </Select>
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={handleCloseModal}>取消</Button>
             <Button onClick={handleSubmit}>{editingAsset ? '保存' : '创建'}</Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

       <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>确认删除</DialogTitle>
             <DialogDescription>
               确定要删除资产 "{deletingAsset?.assetName}" 吗？此操作不可撤销。
             </DialogDescription>
           </DialogHeader>
           <DialogFooter>
             <Button variant="outline" onClick={handleCloseDeleteDialog}>取消</Button>
             <Button variant="destructive" onClick={handleConfirmDelete}>确认删除</Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </div>
   );
 }

 export default AssetsPage;