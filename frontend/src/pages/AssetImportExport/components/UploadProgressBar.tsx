import React from 'react';
import { Progress, Button } from 'antd';
import { RedoOutlined } from '@ant-design/icons';

/**
 * 上传状态类型
 *
 * - uploading: 文件正在上传，进度条为蓝色
 * - parsing:   上传完成，等待后端解析响应
 * - success:   解析成功，组件不渲染（由父组件控制）
 * - error:     上传或解析失败，进度条变红，显示重试按钮
 */
export type UploadStatus = 'uploading' | 'parsing' | 'success' | 'error';

/**
 * UploadProgressBar 组件属性定义
 */
export interface UploadProgressBarProps {
  /** 上传进度百分比 (0-100) */
  percent: number;
  /** 当前上传状态 */
  status: UploadStatus;
  /** 重试按钮点击回调函数 */
  onRetry?: () => void;
  /** 正在上传的文件名（用于展示） */
  fileName?: string;
}

/**
 * FE-4 上传进度条组件
 *
 * 根据 SPEC [SWARM-P2-006-FE] 交互约束与 ATB-006/ATB-007 验收基准实现：
 *
 * - **上传中** (`uploading`): 蓝色进度条，文案格式 "上传中 XX%"，百分比实时递增
 * - **解析中** (`parsing`): 上传达到 100% 后展示 "解析中..." 文案，等待后端响应
 * - **上传失败** (`error`): 进度条变红，显示 "上传失败" 文案与 "重试" 按钮（ATB-007）
 * - **上传成功** (`success`): 组件不渲染，进度条消失（ATB-006 步骤 5）
 *
 * 本组件为纯展示组件，上传逻辑（XMLHttpRequest / axios.onUploadProgress）
 * 由父组件或 useAssetImport hook 管理，通过 props 传入进度与状态。
 *
 * @param props - 组件属性
 * @param props.percent - 上传进度百分比
 * @param props.status - 当前上传状态
 * @param props.onRetry - 重试回调
 * @param props.fileName - 上传文件名
 */
const UploadProgressBar: React.FC<UploadProgressBarProps> = ({
  percent,
  status,
  onRetry,
  fileName,
}) => {
  /** 上传成功后进度条消失，不渲染任何内容 */
  if (status === 'success') {
    return null;
  }

  /** 上传失败状态：红色进度条 + "上传失败" 文案 + "重试" 按钮 */
  if (status === 'error') {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 8,
          background: '#FFF2F0',
          border: '1px solid #FFCCC7',
        }}
      >
        <Progress
          percent={percent > 0 ? percent : 100}
          status="exception"
          strokeColor="#FF4D4F"
          showInfo={false}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          <span style={{ color: '#FF4D4F', fontWeight: 500 }}>上传失败</span>
          {onRetry && (
            <Button
              size="small"
              type="primary"
              danger
              icon={<RedoOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
            >
              重试
            </Button>
          )}
        </div>
      </div>
    );
  }

  /** 解析中状态：上传 100% 完成后等待后端解析响应 */
  if (status === 'parsing') {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 8,
          background: '#F6FFED',
          border: '1px solid #B7EB8F',
        }}
      >
        <Progress
          percent={100}
          status="active"
          strokeColor="#52C41A"
          showInfo={false}
        />
        <div style={{ marginTop: 8, color: '#52C41A', fontWeight: 500 }}>
          解析中...
        </div>
      </div>
    );
  }

  /** 上传中状态：蓝色进度条，实时显示上传百分比 */
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 8,
        background: '#F0F5FF',
        border: '1px solid #ADC6FF',
      }}
    >
      <Progress
        percent={percent}
        status="active"
        strokeColor="#1890FF"
        showInfo={false}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 8,
        }}
      >
        <span style={{ color: '#1890FF', fontWeight: 500 }}>
          上传中 {percent}%
        </span>
        {fileName && (
          <span style={{ color: '#8C8C8C', fontSize: 12 }}>{fileName}</span>
        )}
      </div>
    </div>
  );
};

export default UploadProgressBar;