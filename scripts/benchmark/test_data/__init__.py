"""
DeadCodeVisitor 性能基准测试数据模块

此模块为 Phase 3: 性能优化与基准测试阶段提供不同规模代码库的测试数据集，
支持资源消耗测试、响应时延测试和性能回归测试。

开发切入层级序列：
1. 第一层：基准测试基础设施 - 测试数据集管理机制
2. 第二层：性能指标采集 - 测试数据准备
3. 第三层：测试场景定义 - 多规模代码库测试场景
4. 第四层：自动化执行流程 - 测试数据加载
5. 第五层：报告与可视化 - 测试数据统计

边界约束：
- 测试环境标准化
- 覆盖不同规模代码库（小型<1K行，中型1K-10K行，大型10K-100K行，超大型>100K行）
- 不影响代码分析准确性
- 测试结果具有可重现性
- 支持增量测试
"""

import os
import json
import time
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum
import hashlib


class CodeScale(Enum):
    """代码库规模分类"""
    SMALL = "small"        # < 1K 行
    MEDIUM = "medium"      # 1K-10K 行
    LARGE = "large"        # 10K-100K 行
    EXTRA_LARGE = "xlarge" # > 100K 行


@dataclass
class TestDatasetInfo:
    """测试数据集信息"""
    name: str
    scale: CodeScale
    file_count: int
    total_lines: int
    estimated_dead_code_count: int
    description: str
    created_at: float
    file_paths: List[str]


class BenchmarkDataManager:
    """基准测试数据管理器"""
    
    def __init__(self, base_path: str = "scripts/benchmark/test_data"):
        self.base_path = base_path
        self.datasets: Dict[str, TestDatasetInfo] = {}
        self._ensure_base_directory()
        self._load_existing_datasets()
    
    def _ensure_base_directory(self):
        """确保基准测试数据目录存在"""
        os.makedirs(self.base_path, exist_ok=True)
        os.makedirs(os.path.join(self.base_path, "small"), exist_ok=True)
        os.makedirs(os.path.join(self.base_path, "medium"), exist_ok=True)
        os.makedirs(os.path.join(self.base_path, "large"), exist_ok=True)
        os.makedirs(os.path.join(self.base_path, "xlarge"), exist_ok=True)
    
    def _load_existing_datasets(self):
        """加载已存在的测试数据集"""
        metadata_file = os.path.join(self.base_path, "datasets_metadata.json")
        if os.path.exists(metadata_file):
            try:
                with open(metadata_file, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                    for name, info in metadata.items():
                        self.datasets[name] = TestDatasetInfo(
                            name=name,
                            scale=CodeScale(info['scale']),
                            file_count=info['file_count'],
                            total_lines=info['total_lines'],
                            estimated_dead_code_count=info['estimated_dead_code_count'],
                            description=info['description'],
                            created_at=info['created_at'],
                            file_paths=info['file_paths']
                        )
            except (json.JSONDecodeError, KeyError) as e:
                print(f"Warning: Could not load datasets metadata: {e}")
    
    def _save_datasets_metadata(self):
        """保存测试数据集元数据"""
        metadata_file = os.path.join(self.base_path, "datasets_metadata.json")
        metadata = {
            name: {
                'scale': dataset.scale.value,
                'file_count': dataset.file_count,
                'total_lines': dataset.total_lines,
                'estimated_dead_code_count': dataset.estimated_dead_code_count,
                'description': dataset.description,
                'created_at': dataset.created_at,
                'file_paths': dataset.file_paths
            }
            for name, dataset in self.datasets.items()
        }
        
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    def generate_small_dataset(self, name: str = "small_sample") -> TestDatasetInfo:
        """生成小型测试数据集 (< 1K 行)"""
        dataset_path = os.path.join(self.base_path, "small")
        
        # 生成小型 Python 模块
        files = []
        
        # 主模块
        main_module = os.path.join(dataset_path, f"{name}.py")
        main_code = '''"""
小型测试数据集 - 主模块
包含少量函数和类的简单代码结构
"""

def utility_function():
    """简单的工具函数"""
    return "Hello from small dataset"

class SimpleClass:
    """简单的类定义"""
    
    def __init__(self, value):
        self.value = value
    
    def get_value(self):
        """获取值的方法"""
        return self.value
    
    def set_value(self, new_value):
        """设置值的方法"""
        self.value = new_value

# 可能的死代码示例
def unused_function():
    """未被使用的函数"""
    return "This should be detected as dead code"

class UnusedClass:
    """未被使用的类"""
    pass

def main():
    """主函数"""
    obj = SimpleClass(42)
    print(obj.get_value())
    utility_function()

if __name__ == "__main__":
    main()
'''
        
        with open(main_module, 'w', encoding='utf-8') as f:
            f.write(main_code)
        files.append(main_module)
        
        # 工具模块
        utils_module = os.path.join(dataset_path, f"{name}_utils.py")
        utils_code = '''"""
小型测试数据集 - 工具模块
"""

def helper_function():
    """辅助函数"""
    return "Helper function"

def another_helper():
    """另一个辅助函数"""
    return "Another helper"

# 死代码示例
def dead_helper():
    """未被使用的辅助函数"""
    return "This is dead code"
'''
        
        with open(utils_module, 'w', encoding='utf-8') as f:
            f.write(utils_code)
        files.append(utils_module)
        
        # 计算统计信息
        total_lines = sum(len(open(f, 'r', encoding='utf-8').readlines()) for f in files)
        
        dataset_info = TestDatasetInfo(
            name=name,
            scale=CodeScale.SMALL,
            file_count=len(files),
            total_lines=total_lines,
            estimated_dead_code_count=2,  # 预估的死代码数量
            description="小型测试数据集，包含简单函数和类结构",
            created_at=time.time(),
            file_paths=files
        )
        
        self.datasets[name] = dataset_info
        self._save_datasets_metadata()
        
        return dataset_info
    
    def generate_medium_dataset(self, name: str = "medium_sample") -> TestDatasetInfo:
        """生成中型测试数据集 (1K-10K 行)"""
        dataset_path = os.path.join(self.base_path, "medium")
        
        files = []
        
        # 主应用模块
        main_module = os.path.join(dataset_path, f"{name}.py")
        main_code = '''"""
中型测试数据集 - 主应用模块
包含中等复杂度的业务逻辑
"""

import json
import random
from typing import List, Dict, Optional

class DataProcessor:
    """数据处理器类"""
    
    def __init__(self):
        self.data = []
        self.processed_count = 0
    
    def load_data(self, source_file: str) -> bool:
        """加载数据"""
        try:
            with open(source_file, 'r') as f:
                self.data = json.load(f)
            return True
        except Exception as e:
            print(f"Error loading data: {e}")
            return False
    
    def process_data(self) -> List[Dict]:
        """处理数据"""
        processed = []
        for item in self.data:
            if self._is_valid_item(item):
                processed_item = self._transform_item(item)
                processed.append(processed_item)
                self.processed_count += 1
        return processed
    
    def _is_valid_item(self, item: Dict) -> bool:
        """验证数据项"""
        return isinstance(item, dict) and 'id' in item and 'value' in item
    
    def _transform_item(self, item: Dict) -> Dict:
        """转换数据项"""
        return {
            'id': item['id'],
            'processed_value': item['value'] * 2,
            'timestamp': time.time(),
            'status': 'processed'
        }

class ConfigManager:
    """配置管理器"""
    
    def __init__(self):
        self.config = self._load_default_config()
    
    def _load_default_config(self) -> Dict:
        """加载默认配置"""
        return {
            'max_items': 1000,
            'timeout': 30,
            'retry_count': 3,
            'log_level': 'INFO'
        }
    
    def get_config(self, key: str, default=None):
        """获取配置项"""
        return self.config.get(key, default)

def generate_sample_data(count: int = 100) -> List[Dict]:
    """生成示例数据"""
    data = []
    for i in range(count):
        data.append({
            'id': i,
            'value': random.randint(1, 100),
            'category': f'category_{i % 10}'
        })
    return data

def save_processed_data(data: List[Dict], output_file: str):
    """保存处理后的数据"""
    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)

# 死代码示例
def unused_processor():
    """未被使用的数据处理器"""
    class UnusedProcessor:
        def process(self, data):
            return []
    return UnusedProcessor()

def legacy_function():
    """遗留函数"""
    return "This is legacy code"

def main():
    """主函数"""
    processor = DataProcessor()
    config = ConfigManager()
    
    sample_data = generate_sample_data(50)
    save_processed_data(sample_data, "sample_output.json")
    
    print(f"Processed {processor.processed_count} items")

if __name__ == "__main__":
    import time
    main()
'''
        
        with open(main_module, 'w', encoding='utf-8') as f:
            f.write(main_code)
        files.append(main_module)
        
        # 服务模块
        service_module = os.path.join(dataset_path, f"{name}_services.py")
        service_code = '''"""
中型测试数据集 - 服务模块
包含各种服务类
"""

class APIService:
    """API 服务类"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = None
    
    def connect(self) -> bool:
        """连接到API"""
        # 模拟连接
        self.session = "connected"
        return True
    
    def get_data(self, endpoint: str) -> Dict:
        """获取数据"""
        if not self.session:
            raise Exception("Not connected")
        return {"data": "sample", "endpoint": endpoint}

class DatabaseService:
    """数据库服务类"""
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.connected = False
    
    def connect(self):
        """连接数据库"""
        self.connected = True
    
    def query(self, sql: str) -> List[Dict]:
        """执行查询"""
        if not self.connected:
            raise Exception("Not connected to database")
        return [{"id": 1, "name": "test"}]

class CacheService:
    """缓存服务类"""
    
    def __init__(self):
        self.cache = {}
    
    def get(self, key: str):
        """获取缓存值"""
        return self.cache.get(key)
    
    def set(self, key: str, value, ttl: int = 3600):
        """设置缓存值"""
        self.cache[key] = value
    
    def clear(self):
        """清空缓存"""
        self.cache.clear()

# 死代码示例
class LegacyAPIService:
    """遗留的API服务类"""
    def __init__(self):
        self.old_method = True
    
    def old_request(self, path):
        return "old_request"

def deprecated_function():
    """已弃用的函数"""
    return "deprecated"

def unused_service():
    """未使用的服务"""
    class UnusedService:
        def do_nothing(self):
            pass
    return UnusedService()
'''
        
        with open(service_module, 'w', encoding='utf-8') as f:
            f.write(service_code)
        files.append(service_module)
        
        # 计算统计信息
        total_lines = sum(len(open(f, 'r', encoding='utf-8').readlines()) for f in files)
        
        dataset_info = TestDatasetInfo(
            name=name,
            scale=CodeScale.MEDIUM,
            file_count=len(files),
            total_lines=total_lines,
            estimated_dead_code_count=4,  # 预估的死代码数量
            description="中型测试数据集，包含业务逻辑、服务类和数据处理器",
            created_at=time.time(),
            file_paths=files
        )
        
        self.datasets[name] = dataset_info
        self._save_datasets_metadata()
        
        return dataset_info
    
    def get_dataset(self, name: str) -> Optional[TestDatasetInfo]:
        """获取指定数据集"""
        return self.datasets.get(name)
    
    def list_datasets(self) -> List[TestDatasetInfo]:
        """列出所有数据集"""
        return list(self.datasets.values())
    
    def get_datasets_by_scale(self, scale: CodeScale) -> List[TestDatasetInfo]:
        """按规模筛选数据集"""
        return [dataset for dataset in self.datasets.values() if dataset.scale == scale]
    
    def get_dataset_statistics(self) -> Dict:
        """获取数据集统计信息"""
        stats = {
            'total_datasets': len(self.datasets),
            'by_scale': {
                scale.value: len([d for d in self.datasets.values() if d.scale == scale])
                for scale in CodeScale
            },
            'total_files': sum(d.file_count for d in self.datasets.values()),
            'total_lines': sum(d.total_lines for d in self.datasets.values()),
            'avg_files_per_dataset': sum(d.file_count for d in self.datasets.values()) / len(self.datasets) if self.datasets else 0,
            'avg_lines_per_dataset': sum(d.total_lines for d in self.datasets.values()) / len(self.datasets) if self.datasets else 0
        }
        return stats
    
    def validate_dataset_integrity(self, name: str) -> bool:
        """验证数据集完整性"""
        dataset = self.get_dataset(name)
        if not dataset:
            return False
        
        # 检查所有文件是否存在
        for file_path in dataset.file_paths:
            if not os.path.exists(file_path):
                return False
        
        # 检查文件内容基本完整性
        try:
            for file_path in dataset.file_paths:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if not content.strip():
                        return False
        except Exception:
            return False
        
        return True
    
    def cleanup_dataset(self, name: str) -> bool:
        """清理数据集文件"""
        dataset = self.get_dataset(name)
        if not dataset:
            return False
        
        try:
            for file_path in dataset.file_paths:
                if os.path.exists(file_path):
                    os.remove(file_path)
            
            # 从内存中移除数据集
            del self.datasets[name]
            self._save_datasets_metadata()
            
            return True
        except Exception:
            return False


# 全局数据管理器实例
data_manager = BenchmarkDataManager()


def get_default_datasets() -> Tuple[TestDatasetInfo, ...]:
    """获取默认测试数据集"""
    # 确保默认数据集存在
    small_dataset = data_manager.get_dataset("small_sample")
    if not small_dataset:
        small_dataset = data_manager.generate_small_dataset("small_sample")
    
    medium_dataset = data_manager.get_dataset("medium_sample")
    if not medium_dataset:
        medium_dataset = data_manager.generate_medium_dataset("medium_sample")
    
    return small_dataset, medium_dataset


def get_dataset_for_scale(scale: CodeScale) -> Optional[TestDatasetInfo]:
    """获取指定规模的测试数据集"""
    datasets = data_manager.get_datasets_by_scale(scale)
    return datasets[0] if datasets else None


def benchmark_test_data_available() -> bool:
    """检查基准测试数据是否可用"""
    return len(data_manager.list_datasets()) > 0


def print_dataset_info():
    """打印数据集信息"""
    print("=== 基准测试数据集信息 ===")
    stats = data_manager.get_dataset_statistics()
    print(f"总数据集数量: {stats['total_datasets']}")
    print(f"总文件数量: {stats['total_files']}")
    print(f"总代码行数: {stats['total_lines']}")
    print(f"平均每个数据集文件数: {stats['avg_files_per_dataset']:.1f}")
    print(f"平均每个数据集代码行数: {stats['avg_lines_per_dataset']:.1f}")
    
    print("\n按规模分布:")
    for scale, count in stats['by_scale'].items():
        print(f"  {scale}: {count} 个数据集")
    
    print("\n数据集详情:")
    for dataset in data_manager.list_datasets():
        print(f"  - {dataset.name} ({dataset.scale.value}): {dataset.file_count} 文件, {dataset.total_lines} 行")


if __name__ == "__main__":
    # 初始化默认数据集
    small, medium = get_default_datasets()
    
    print("基准测试数据模块初始化完成")
    print_dataset_info()