import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inspectionApi } from '@/api/inspection';
import { Card, Upload, Button, message, Spin, Space, Image, Row, Col, Breadcrumb, Typography, Progress, Alert } from 'antd';
import { ArrowLeftOutlined, UploadOutlined, DeleteOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';

const { Title } = Typography;

interface Photo {
  id: number;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  createTime: string;
}

const InspectionUploadPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 查询检验记录
  const { data: inspection, isLoading } = useQuery({
    queryKey: ['inspection', id],
    queryFn: () => inspectionApi.getById(Number(id)),
    enabled: !!id
  });

  // 查询照片列表
  const { data: photos, refetch: refetchPhotos } = useQuery({
    queryKey: ['inspection-photos', id],
    queryFn: () => inspectionApi.getPhotos(Number(id)),
    enabled: !!id
  });

  // 删除照片
  const deletePhotoMutation = useMutation({
    mutationFn: (attachmentId: number) => inspectionApi.deletePhoto(attachmentId),
    onSuccess: () => {
      message.success('删除成功');
      refetchPhotos();
    },
    onError: (error) => {
      message.error(`删除失败：${error}`);
    }
  });

  const uploadProps: UploadProps = {
    name: 'file',
    listType: 'picture-card',
    fileList: fileList,
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件');
        return false;
      }
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('图片大小不能超过 10MB');
        return false;
      }
      return true;
    },
    customRequest: async (options) => {
      const { file, onSuccess, onError, onProgress } = options;
      setUploading(true);
      setUploadProgress(0);

      try {
        await inspectionApi.uploadPhoto(Number(id), file as File);
        setUploadProgress(100);
        onSuccess?.(file);
        message.success('上传成功');
        refetchPhotos();
        queryClient.invalidateQueries({ queryKey: ['inspection', id] });
      } catch (error) {
        onError?.(error as Error);
        message.error(`上传失败：${error}`);
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    onChange: ({ fileList: newFileList }) => {
      setFileList(newFileList);
    },
    disabled: uploading
  };

  const handleBatchUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择要上传的照片');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const totalFiles = fileList.length;
      const uploadedUrls: string[] = [];

      for (let i = 0; i < totalFiles; i++) {
        const file = fileList[i];
        if (file.originFileObj) {
          try {
            const result = await inspectionApi.uploadPhoto(Number(id), file.originFileObj as File);
            uploadedUrls.push(result.filePath);
            setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
          } catch (error) {
            message.error(`上传第 ${i + 1} 张照片失败`);
          }
        }
      }

      message.success(`成功上传 ${uploadedUrls.length} / ${totalFiles} 张照片`);
      setFileList([]);
      refetchPhotos();
      queryClient.invalidateQueries({ queryKey: ['inspection', id] });
    } catch (error) {
      message.error(`批量上传失败：${error}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = (photo: Photo) => {
    deletePhotoMutation.mutate(photo.id);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Breadcrumb className="mb-4">
        <Breadcrumb.Item>
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/inspections')}
          >
            检验记录列表
          </Button>
        </Breadcrumb.Item>
        <Breadcrumb.Item>检验记录详情</Breadcrumb.Item>
        <Breadcrumb.Item>照片上传</Breadcrumb.Item>
      </Breadcrumb>

      <Title level={2} className="mb-6">
        检验照片上传
        {inspection && (
          <span className="ml-4 text-base text-gray-500 font-normal">
            检验编号: {(inspection as any).inspectionNo}
          </span>
        )}
      </Title>

      <Card title="上传新照片" className="mb-6">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Upload {...uploadProps}>
            <div>
              <UploadOutlined />
              <div style={{ marginTop: 8 }}>选择照片</div>
            </div>
          </Upload>

          {uploading && (
            <Alert
              message="上传中..."
              description={
                <Progress
                  percent={uploadProgress}
                  status="active"
                  strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                />
              }
              type="info"
              showIcon
            />
          )}

          {fileList.length > 0 && (
            <Space>
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={handleBatchUpload}
                loading={uploading}
                disabled={uploading}
              >
                批量上传 ({fileList.length} 张)
              </Button>
              <Button onClick={() => setFileList([])} disabled={uploading}>
                清空
              </Button>
            </Space>
          )}
        </Space>
      </Card>

      <Card title="已上传照片" extra={<span className="text-gray-500">共 {(photos as Photo[])?.length || 0} 张</span>}>
        {!(photos as Photo[]) || (photos as Photo[]).length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CheckCircleOutlined className="text-4xl mb-2" />
            <p>暂无已上传的照片</p>
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            {(photos as Photo[]).map((photo) => (
              <Col key={photo.id} xs={24} sm={12} md={8} lg={6} xl={4}>
                <Card
                  hoverable
                  cover={
                    <Image
                      src={photo.filePath}
                      alt={photo.fileName}
                      style={{ height: 180, objectFit: 'cover' }}
                      preview={{
                        mask: <div>点击预览</div>
                      }}
                    />
                  }
                  actions={[
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDelete(photo)}
                    >
                      删除
                    </Button>
                  ]}
                >
                  <Card.Meta
                    title={photo.fileName}
                    description={
                      <Space direction="vertical" size="small">
                        <span className="text-gray-500">
                          {(photo.fileSize / 1024).toFixed(2)} KB
                        </span>
                        <span className="text-gray-400">
                          {new Date(photo.createTime).toLocaleString()}
                        </span>
                      </Space>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      <div className="mt-6 text-center">
        <Button
          size="large"
          onClick={() => navigate(`/inspections/${id}`)}
        >
          返回详情页
        </Button>
      </div>
    </div>
  );
};

export default InspectionUploadPage;