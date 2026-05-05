import React from 'react';
import { Progress, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

/**
 * 上传进度条组件
 *
 * 展示文件上传实时进度，支持三种状态：
 * - uploading: 蓝色动态进度条 + 百分比文案；progress >= 100 时自动切换为「解析中...」
 * - error: 红色进度条 + 「上传失败」文案 + 重试按钮
 * - success: 返回 null，由父组件隐藏本组件并展示解析结果表格
 *
 * @see ATB-006 上传进度条
 * @see ATB-007 上传失败重试
 */
export interface UploadProgressProps {
  /** 上传进度百分比，范围 0-100 */
  progress: number;
  /** 上传状态 */
  status: 'uploading' | 'success' | 'error';
  /** 上传失败时的重试回调函数 */
  onRetry?: () => void;
}

const UploadProgress: React.FC<UploadProgressProps> = ({
  progress,
  status = 'uploading',
  onRetry,
}) => {
  /** 失败状态：进度条变红，显示「上传失败」文案与重试按钮 */
  if (status === 'error') {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <Progress
          percent={progress}
          status="exception"
          showInfo={false}
        />
        <div style={{ marginTop: 16, fontSize: 16, color: '#ff4d4f' }}>
          上传失败
        </div>
        {onRetry && (
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={onRetry}
            style={{ marginTop: 12 }}
          >
            重试
          </Button>
        )}
      </div>
    );
  }

  /** 成功状态：父组件通常会隐藏本组件，改为展示解析结果预览表格 */
  if (status === 'success') {
    return null;
  }

  /**
   * 上传中状态：
   * - progress < 100: 蓝色动态进度条，文案显示「上传中 XX%」
   * - progress >= 100: 上传数据已全部发出，等待服务器响应，文案切换为「解析中...」
   */
  const isParsing = progress >= 100;

  return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
      <Progress
        percent={Math.min(progress, 100)}
        status="active"
        strokeColor="#1890ff"
        showInfo={false}
      />
      <div style={{ marginTop: 16, fontSize: 16, color: '#595959' }}>
        {isParsing ? '解析中...' : `上传中 ${progress}%`}
      </div>
    </div>
  );
};

export default UploadProgress;