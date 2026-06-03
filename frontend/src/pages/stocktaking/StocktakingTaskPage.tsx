import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Camera, QrCode, Save, AlertCircle, Check, X } from 'lucide-react';

// 动态导入 html5-qrcode（仅在需要时加载）
const Html5Qrcode = typeof window !== 'undefined' ? require('html5-qrcode').Html5Qrcode : null;

export default function StocktakingTaskPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<any>(null);
  const [quantity, setQuantity] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMode, setScanMode] = useState<'auto' | 'manual'>('manual');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);

  const scannerRef = useRef<any>(null);

  useEffect(() => {
    fetchTask();
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [taskId]);

  const fetchTask = async () => {
    try {
      const response = await fetch(`/api/stocktaking/tasks/${taskId}`);
      const data = await response.json();
      setTask(data.data);
      setQuantity(data.data.expectedQuantity);
    } catch (error) {
      console.error('获取任务失败:', error);
      setCameraError('获取任务失败');
    }
  };

  const startScanner = async () => {
    setScanMode('auto');
    setIsScanning(true);
    setCameraError(null);

    if (!Html5Qrcode) {
      setCameraError('扫码器库加载失败，请使用手动输入模式');
      return;
    }

    try {
      const scanner = new Html5Qrcode('reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScanResult(decodedText);
        },
        (errorMessage) => {
          // 忽略扫描过程中的错误
        }
      );
    } catch (error) {
      console.error('启动扫码器失败:', error);
      setCameraError('无法访问相机，请确保已授予相机权限');
      stopScanner();
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(console.error);
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleScanResult = (decodedText: string) => {
    stopScanner();
    // 这里可以解析扫码结果并预填数量
    console.log('扫码结果:', decodedText);
    alert(`扫码成功: ${decodedText}`);
  };

  const handleManualSubmit = async () => {
    if (!quantity || quantity < 0) {
      alert('请输入有效的数量');
      return;
    }

    setSubmitting(true);
    try {
      await fetch(`/api/stocktaking/tasks/${taskId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity, photoUrl: photo }),
      });

      setResult('success');

      const variance = quantity - task.expectedQuantity;
      if (variance !== 0) {
        const shouldAdjust = confirm(
          `发现差异: ${variance > 0 ? '+' : ''}${variance}\n是否需要调整？`
        );
        if (shouldAdjust) {
          await fetch(`/api/stocktaking/tasks/${taskId}/adjust`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threshold: 1000, reason: '盘点差异调整' }),
          });
        }
      }

      setTimeout(() => {
        navigate(-1);
      }, 2000);
    } catch (error) {
      console.error('提交失败:', error);
      setResult('error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      await new Promise((resolve) => setTimeout(resolve, 100));
      canvas.getContext('2d')?.drawImage(video, 0, 0);

      const photoUrl = canvas.toDataURL('image/jpeg');
      setPhoto(photoUrl);

      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      console.error('拍照失败:', error);
      alert('拍照失败，请确保已授予相机权限');
    }
  };

  const handleRetry = () => {
    setResult(null);
  };

  if (!task) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (result === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full">
          <div className="text-center">
            <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">盘点成功</h2>
            <p className="text-gray-600">数据已保存</p>
          </div>
        </div>
      </div>
    );
  }

  if (result === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full">
          <div className="text-center">
            <X className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">提交失败</h2>
            <p className="text-gray-600 mb-4">请重试</p>
            <button
              onClick={handleRetry}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <h1 className="text-lg font-bold">盘点任务 #{task.id}</h1>
          <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
            返回
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* 任务信息 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">任务信息</h2>
            <span className={`px-2 py-1 rounded text-xs ${
              task.status === 'PENDING' ? 'bg-blue-100 text-blue-700' :
              task.status === 'COUNTED' ? 'bg-green-100 text-green-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {task.status === 'PENDING' ? '待盘点' :
               task.status === 'COUNTED' ? '已盘点' : '已调整'}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">预期数量</span>
              <span className="font-semibold">{task.expectedQuantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">资产ID</span>
              <span>{task.assetId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">地点ID</span>
              <span>{task.locationId}</span>
            </div>
          </div>
        </div>

        {/* 扫码器区域 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">盘点方式</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setScanMode('manual')}
                className={`px-3 py-1 rounded text-sm ${
                  scanMode === 'manual'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                手动输入
              </button>
              <button
                onClick={() => {
                  if (scanMode === 'auto') {
                    stopScanner();
                  } else {
                    startScanner();
                  }
                }}
                className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
                  scanMode === 'auto'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {scanMode === 'auto' ? '停止扫码' : '自动扫码'}
              </button>
            </div>
          </div>

          {cameraError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                {cameraError}
              </div>
            </div>
          )}

          {scanMode === 'auto' && !cameraError && (
            <div className="mb-4">
              <div id="reader" className="w-full overflow-hidden rounded-lg" />
            </div>
          )}

          {scanMode === 'manual' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                实际数量
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="输入实际数量"
              />
            </div>
          )}
        </div>

        {/* 拍照记录 */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">照片记录</h2>
          {photo ? (
            <div className="mb-4">
              <img
                src={photo}
                alt="盘点照片"
                className="w-full rounded-lg"
              />
              <button
                onClick={() => setPhoto(null)}
                className="mt-2 text-sm text-red-600 hover:text-red-700"
              >
                删除照片
              </button>
            </div>
          ) : (
            <button
              onClick={handleCameraCapture}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Camera className="w-5 h-5" />
              拍照记录
            </button>
          )}
        </div>

        {/* 提交按钮 */}
        <button
          onClick={handleManualSubmit}
          disabled={submitting || isScanning}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-500 text-white text-lg font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              提交中...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              提交盘点结果
            </>
          )}
        </button>
      </div>
    </div>
  );
}