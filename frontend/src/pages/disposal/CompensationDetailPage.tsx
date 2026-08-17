import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { getCompensationDetail } from '@/api/disposal';

function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CompensationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const compensationId = Number(id);
  const validId = Number.isSafeInteger(compensationId) && compensationId > 0;
  const { data: detail, isLoading, isError } = useQuery({
    queryKey: ['compensation', compensationId],
    queryFn: () => getCompensationDetail(compensationId),
    enabled: validId,
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">加载赔偿详情...</div>;
  }

  if (!validId || isError || !detail) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">赔偿详情加载失败，请重试</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate('/disposals')}>
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="资产赔偿详情"
        breadcrumbs={[
          { label: '资产处置', href: '/disposals' },
          { label: '资产赔偿', href: '/disposals' },
          { label: '赔偿详情' },
        ]}
        actions={
          <Button variant="outline" onClick={() => navigate('/disposals')}>
            返回列表
          </Button>
        }
      />
      <Card>
        <CardContent className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">赔偿编号</p>
            <p className="mt-1 font-semibold">{detail.compensationNo}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">当前状态</p>
            <p className="mt-1 font-semibold">{detail.status}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">资产 ID</p>
            <p className="mt-1 font-semibold">{detail.assetId}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">赔偿类型</p>
            <p className="mt-1 font-semibold">{detail.compensationType}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">赔偿金额</p>
            <p className="mt-1 font-semibold">¥ {formatAmount(detail.compensationAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">责任人 ID</p>
            <p className="mt-1 font-semibold">{detail.responsibleUserId}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">责任部门 ID</p>
            <p className="mt-1 font-semibold">{detail.responsibleDeptId ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">发生日期</p>
            <p className="mt-1 font-semibold">{detail.incidentDate ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">创建时间</p>
            <p className="mt-1 font-semibold">{detail.createTime ?? '—'}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs text-slate-500">赔偿事由</p>
            <p className="mt-1 whitespace-pre-wrap font-semibold">{detail.description ?? '—'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
