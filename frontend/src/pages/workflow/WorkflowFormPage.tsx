import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import DOMPurify from 'dompurify';
import { workflowApi, type WorkflowDefinitionDTO } from '@/api/workflow';
import { submitApproval } from '@/api/approval';

export default function WorkflowFormPage() {
  const { businessType } = useParams<{ businessType: string }>();
  const navigate = useNavigate();
  const formContainerRef = useRef<HTMLDivElement>(null);

  const [flowName, setFlowName] = useState('');
  const [formSource, setFormSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!businessType) {
      setLoading(false);
      setError('无效的流程编码，请从审批中心重新访问');
      return;
    }
    (async () => {
      try {
        const raw = await workflowApi.get(businessType);
        const def = raw as WorkflowDefinitionDTO;
        const defData = def.definition as Record<string, unknown> | undefined;
        setFlowName(def.name || businessType);
        setFormSource((defData?.formSource as string) || '');
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载流程定义失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [businessType]);

  const handleSubmit = async () => {
    if (!businessType) return;
    setSubmitting(true);
    setError(null);
    try {
      // 从 HTML 表单中收集字段值
      const formEl = formContainerRef.current?.querySelector('form');
      let businessData: Record<string, string> = {};
      let titleExtra = '';
      if (formEl) {
        const fd = new FormData(formEl);
        fd.forEach((val, key) => {
          businessData[key] = String(val);
        });
        // 用表单第一个 input/textarea 的值作为标题补充（如申请事由等）
        const firstInput = formEl.querySelector<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], textarea');
        if (firstInput?.value) titleExtra = ` - ${firstInput.value.slice(0, 30)}`;
      }

      await submitApproval({
        businessType,
        title: `${flowName}${titleExtra}`,
        description: JSON.stringify(businessData),
        businessData: JSON.stringify(businessData),
      });

      setSuccessMsg('申请已提交，请等待审批');
      // 延迟跳转，让用户看到成功提示
      setTimeout(() => navigate('/approvals'), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !formSource) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{flowName || businessType}</h1>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (!formSource) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{flowName || businessType}</h1>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          该流程尚未配置表单源码。请在工作流设计器的「表单源码」标签页中添加表单 HTML。
        </div>
        {/* 即使没有表单也允许空表单发起 */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-2 bg-[#004191] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {submitting ? '提交中...' : '直接发起申请'}
        </button>
        {successMsg && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMsg}</div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{flowName}</h1>
          <p className="text-xs text-gray-400 mt-0.5">填写表单后点击「提交申请」进入审批流程</p>
        </div>
      </div>

      {/* Form HTML — 经过 DOMPurify 安全过滤，防止 XSS 攻击（P2-06） */}
      <div
        ref={formContainerRef}
        className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formSource) }}
      />

      {/* Error / success feedback */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMsg}</div>
      )}

      {/* Submit bar */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-2 bg-[#004191] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {submitting ? '提交中...' : '提交申请'}
        </button>
      </div>
    </div>
  );
}
