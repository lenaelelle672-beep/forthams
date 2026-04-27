import React, { useEffect, useState, useCallback } from 'react';
import { Cascader, message } from 'antd';
import type { DefaultOptionType } from 'antd/es/cascader';
import { http } from '@/utils/http';

/**
 * 存放位置级联选择器组件属性
 */
interface LocationCascaderProps {
  /** 当前选中的位置代码路径（如 ['110000', '110100', '110101']） */
  value?: string[];
  /** 选中变化时的回调函数 */
  onChange?: (value: string[]) => void;
  /** 占位提示文案 */
  placeholder?: string;
  /** 是否禁用选择器 */
  disabled?: boolean;
  /** 自定义行内样式 */
  style?: React.CSSProperties;
  /** 自定义 CSS 类名 */
  className?: string;
}

/**
 * LocationCascader — 存放位置级联选择器
 *
 * 用于导出筛选面板中的存放位置选择，支持省/市/区三级联动。
 * 数据来源于后端接口 GET /api/v1/asset-locations/cascade。
 *
 * 遵循 SPEC [SWARM-P2-006-FE] Layer 3.1 要求：
 * - 组件类型为 Ant Design Cascader
 * - 支持省/市/区级联选择
 * - 选中值类型为 string[]，直接对应导出请求中的 locationCodes 字段
 *
 * @param props - LocationCascader 组件属性
 * @returns 级联选择器 React 节点
 */
const LocationCascader: React.FC<LocationCascaderProps> = ({
  value,
  onChange,
  placeholder = '请选择存放位置',
  disabled = false,
  style,
  className,
}) => {
  /** 级联选项数据（兼容 AntD Cascader DefaultOptionType 格式） */
  const [options, setOptions] = useState<DefaultOptionType[]>([]);
  /** 数据加载中标记 */
  const [loading, setLoading] = useState<boolean>(false);
  /** 是否已尝试加载数据（防止重复请求） */
  const [loaded, setLoaded] = useState<boolean>(false);

  /**
   * 从后端获取位置级联数据
   *
   * 接口返回格式应为 DefaultOptionType[] 数组，
   * 每项包含 value、label 及可选的 children。
   * 兼容 { data: [...] } 包装格式和直接数组返回。
   */
  const fetchCascadeData = useCallback(async () => {
    if (loaded) return;

    setLoading(true);
    try {
      const response = await http.get('/api/v1/asset-locations/cascade');

      // 兼容多种响应格式：{ data: [...] } 或直接返回数组
      const rawData = response.data?.data ?? response.data ?? [];
      const cascadeOptions = Array.isArray(rawData) ? rawData : [];

      setOptions(cascadeOptions);
      setLoaded(true);
    } catch (error: unknown) {
      console.error('[LocationCascader] 获取位置级联数据失败:', error);

      // 区分 401 Token 过期与其他错误
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error
      ) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 401) {
          message.error('登录已过期，请重新登录');
          return;
        }
      }

      message.error('获取位置数据失败，请稍后重试');
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [loaded]);

  /** 组件挂载时获取级联数据，卸载时避免设置 state */
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (loaded) return;

      setLoading(true);
      try {
        const response = await http.get('/api/v1/asset-locations/cascade');
        const rawData = response.data?.data ?? response.data ?? [];
        const cascadeOptions = Array.isArray(rawData) ? rawData : [];
        if (isMounted) {
          setOptions(cascadeOptions);
          setLoaded(true);
        }
      } catch (error: unknown) {
        console.error('[LocationCascader] 获取位置级联数据失败:', error);

        if (
          typeof error === 'object' &&
          error !== null &&
          'response' in error
        ) {
          const axiosError = error as { response?: { status?: number } };
          if (axiosError.response?.status === 401) {
            if (isMounted) {
              message.error('登录已过期，请重新登录');
            }
            return;
          }
        }

        if (isMounted) {
          message.error('获取位置数据失败，请稍后重试');
          setOptions([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 处理级联选择变化
   *
   * 将 AntD Cascader 返回的 (string | number)[] 统一转换为 string[]，
   * 以匹配导出请求中 locationCodes: string[] 的类型要求。
   */
  const handleChange = (
    selectedValue: (string | number)[],
    _selectedOptions: DefaultOptionType[],
  ) => {
    if (onChange) {
      onChange(selectedValue.map(String));
    }
  };

  return (
    <Cascader
      options={options}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      loading={loading}
      changeOnSelect
      allowClear
      showSearch={{
        filter: (inputValue, path) =>
          path.some(
            (option) =>
              (option.label as string)?.toLowerCase().includes(inputValue.toLowerCase()),
          ),
      }}
      style={{ width: '100%', ...style }}
      className={className}
      notFoundContent={loading ? '加载中...' : '暂无数据'}
    />
  );
};

export default LocationCascader;