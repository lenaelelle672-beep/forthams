"""
DeadCodeVisitor 性能基准测试数据管理器

该模块提供基准测试所需的数据管理功能，包括：
1. 测试数据集管理（小型、中型、大型、超大型代码库）
2. 性能数据收集和存储
3. 测试场景配置管理
4. 资源消耗监控接口

对应 SPEC Phase 3: 性能优化与基准测试阶段
"""

import os
import json
import time
import psutil
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import memory_profiler
import pandas as pd


class DatasetSize(Enum):
    """代码库规模分类"""
    SMALL = "small"        # < 1K 行
    MEDIUM = "medium"      # 1K-10K 行
    LARGE = "large"        # 10K-100K 行
    EXTRA_LARGE = "extra_large"  # > 100K 行


@dataclass
class PerformanceMetrics:
    """性能指标数据结构"""
    execution_time: float = 0.0
    peak_memory_usage: float = 0.0
    average_cpu_usage: float = 0.0
    memory_delta: float = 0.0
    timestamp: datetime = field(default_factory=datetime.now)
    dataset_size: DatasetSize = DatasetSize.SMALL
    file_count: int = 0
    line_count: int = 0
    dead_code_count: int = 0
    error_count: int = 0


@dataclass
class TestDataset:
    """测试数据集配置"""
    name: str
    size: DatasetSize
    path: Path
    description: str
    expected_dead_code_count: int = 0
    file_count: int = 0
    line_count: int = 0
    created_at: datetime = field(default_factory=datetime.now)


class DataManager:
    """基准测试数据管理器"""
    
    def __init__(self, base_path: Path = Path("tests/benchmark/data")):
        self.base_path = Path(base_path)
        self.datasets_path = self.base_path / "datasets"
        self.results_path = self.base_path / "results"
        self.config_path = self.base_path / "config"
        
        # 确保目录存在
        self.datasets_path.mkdir(parents=True, exist_ok=True)
        self.results_path.mkdir(parents=True, exist_ok=True)
        self.config_path.mkdir(parents=True, exist_ok=True)
        
        # 初始化日志
        self.logger = self._setup_logger()
        
        # 加载配置
        self.config = self._load_config()
        
        # 初始化测试数据集
        self.datasets: Dict[str, TestDataset] = {}
        self._load_datasets()
        
        # 性能指标历史记录
        self.performance_history: List[PerformanceMetrics] = []
        
        # 系统监控
        self.process = psutil.Process()
        
    def _setup_logger(self) -> logging.Logger:
        """设置日志记录器"""
        logger = logging.getLogger("DataManager")
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            
        return logger
    
    def _load_config(self) -> Dict[str, Any]:
        """加载配置文件"""
        config_file = self.config_path / "benchmark_config.json"
        if config_file.exists():
            try:
                with open(config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                self.logger.warning(f"加载配置文件失败: {e}")
        
        # 默认配置
        default_config = {
            "test_environment": {
                "python_version": "3.9+",
                "memory_limit_mb": 8192,
                "cpu_cores": 4,
                "timeout_seconds": 300
            },
            "test_scenarios": {
                "small_dataset": {"min_files": 5, "max_files": 20},
                "medium_dataset": {"min_files": 20, "max_files": 100},
                "large_dataset": {"min_files": 100, "max_files": 500},
                "extra_large_dataset": {"min_files": 500, "max_files": 2000}
            },
            "performance_thresholds": {
                "max_execution_time_seconds": 60,
                "max_memory_usage_mb": 4096,
                "max_cpu_usage_percent": 80
            }
        }
        
        # 保存默认配置
        self._save_config(default_config)
        return default_config
    
    def _save_config(self, config: Dict[str, Any]) -> None:
        """保存配置文件"""
        config_file = self.config_path / "benchmark_config.json"
        try:
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
        except Exception as e:
            self.logger.error(f"保存配置文件失败: {e}")
    
    def _load_datasets(self) -> None:
        """加载测试数据集"""
        datasets_file = self.datasets_path / "datasets.json"
        if datasets_file.exists():
            try:
                with open(datasets_file, 'r', encoding='utf-8') as f:
                    datasets_data = json.load(f)
                    for name, data in datasets_data.items():
                        dataset = TestDataset(
                            name=data["name"],
                            size=DatasetSize(data["size"]),
                            path=Path(data["path"]),
                            description=data["description"],
                            expected_dead_code_count=data.get("expected_dead_code_count", 0),
                            file_count=data.get("file_count", 0),
                            line_count=data.get("line_count", 0),
                            created_at=datetime.fromisoformat(data["created_at"])
                        )
                        self.datasets[name] = dataset
            except Exception as e:
                self.logger.warning(f"加载数据集失败: {e}")
    
    def save_datasets(self) -> None:
        """保存测试数据集配置"""
        datasets_file = self.datasets_path / "datasets.json"
        try:
            datasets_data = {}
            for name, dataset in self.datasets.items():
                datasets_data[name] = {
                    "name": dataset.name,
                    "size": dataset.size.value,
                    "path": str(dataset.path),
                    "description": dataset.description,
                    "expected_dead_code_count": dataset.expected_dead_code_count,
                    "file_count": dataset.file_count,
                    "line_count": dataset.line_count,
                    "created_at": dataset.created_at.isoformat()
                }
            
            with open(datasets_file, 'w', encoding='utf-8') as f:
                json.dump(datasets_data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            self.logger.error(f"保存数据集配置失败: {e}")
    
    def create_test_dataset(self, name: str, size: DatasetSize, 
                          source_path: Path, description: str = "") -> TestDataset:
        """创建测试数据集"""
        if name in self.datasets:
            raise ValueError(f"数据集 '{name}' 已存在")
        
        # 创建数据集目录
        dataset_path = self.datasets_path / name
        dataset_path.mkdir(exist_ok=True)
        
        # 复制源文件到数据集目录
        self._copy_dataset_files(source_path, dataset_path)
        
        # 统计文件信息
        file_count, line_count = self._analyze_dataset(dataset_path)
        
        # 创建数据集对象
        dataset = TestDataset(
            name=name,
            size=size,
            path=dataset_path,
            description=description,
            file_count=file_count,
            line_count=line_count
        )
        
        self.datasets[name] = dataset
        self.save_datasets()
        
        self.logger.info(f"创建测试数据集: {name} ({size.value})")
        return dataset
    
    def _copy_dataset_files(self, source: Path, destination: Path) -> None:
        """复制数据集文件"""
        import shutil
        
        for item in source.rglob("*"):
            if item.is_file():
                rel_path = item.relative_to(source)
                dest_file = destination / rel_path
                dest_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(item, dest_file)
    
    def _analyze_dataset(self, path: Path) -> Tuple[int, int]:
        """分析数据集文件统计信息"""
        file_count = 0
        line_count = 0
        
        for file_path in path.rglob("*.py"):
            if file_path.is_file():
                file_count += 1
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        lines = len(f.readlines())
                        line_count += lines
                except Exception:
                    continue
        
        return file_count, line_count
    
    def get_dataset(self, name: str) -> Optional[TestDataset]:
        """获取测试数据集"""
        return self.datasets.get(name)
    
    def list_datasets(self) -> List[TestDataset]:
        """列出所有测试数据集"""
        return list(self.datasets.values())
    
    def get_datasets_by_size(self, size: DatasetSize) -> List[TestDataset]:
        """按规模筛选数据集"""
        return [dataset for dataset in self.datasets.values() if dataset.size == size]
    
    def collect_performance_metrics(self, dataset_name: str, 
                                 execution_time: float,
                                 dead_code_count: int,
                                 error_count: int = 0) -> PerformanceMetrics:
        """收集性能指标"""
        dataset = self.get_dataset(dataset_name)
        if not dataset:
            raise ValueError(f"数据集 '{dataset_name}' 不存在")
        
        # 获取系统资源使用情况
        memory_info = self.process.memory_info()
        cpu_percent = self.process.cpu_percent()
        
        metrics = PerformanceMetrics(
            execution_time=execution_time,
            peak_memory_usage=memory_info.rss / 1024 / 1024,  # MB
            average_cpu_usage=cpu_percent,
            memory_delta=memory_info.vms / 1024 / 1024,  # MB
            dataset_size=dataset.size,
            file_count=dataset.file_count,
            line_count=dataset.line_count,
            dead_code_count=dead_code_count,
            error_count=error_count
        )
        
        self.performance_history.append(metrics)
        self._save_performance_metrics(metrics)
        
        return metrics
    
    def _save_performance_metrics(self, metrics: PerformanceMetrics) -> None:
        """保存性能指标"""
        timestamp = metrics.timestamp.strftime("%Y%m%d_%H%M%S")
        filename = f"performance_{timestamp}.json"
        filepath = self.results_path / filename
        
        try:
            metrics_data = {
                "timestamp": metrics.timestamp.isoformat(),
                "execution_time": metrics.execution_time,
                "peak_memory_usage": metrics.peak_memory_usage,
                "average_cpu_usage": metrics.average_cpu_usage,
                "memory_delta": metrics.memory_delta,
                "dataset_size": metrics.dataset_size.value,
                "file_count": metrics.file_count,
                "line_count": metrics.line_count,
                "dead_code_count": metrics.dead_code_count,
                "error_count": metrics.error_count
            }
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(metrics_data, f, indent=2, ensure_ascii=False)
                
        except Exception as e:
            self.logger.error(f"保存性能指标失败: {e}")
    
    def get_performance_summary(self) -> pd.DataFrame:
        """获取性能指标汇总"""
        if not self.performance_history:
            return pd.DataFrame()
        
        data = []
        for metrics in self.performance_history:
            data.append({
                "timestamp": metrics.timestamp,
                "execution_time": metrics.execution_time,
                "peak_memory_usage": metrics.peak_memory_usage,
                "average_cpu_usage": metrics.average_cpu_usage,
                "memory_delta": metrics.memory_delta,
                "dataset_size": metrics.dataset_size.value,
                "file_count": metrics.file_count,
                "line_count": metrics.line_count,
                "dead_code_count": metrics.dead_code_count,
                "error_count": metrics.error_count
            })
        
        return pd.DataFrame(data)
    
    def generate_performance_report(self, output_path: Path = None) -> str:
        """生成性能报告"""
        if output_path is None:
            output_path = self.results_path / "performance_report.html"
        
        df = self.get_performance_summary()
        if df.empty:
            return "暂无性能数据"
        
        # 生成HTML报告
        html_content = self._generate_html_report(df)
        
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            return str(output_path)
        except Exception as e:
            self.logger.error(f"生成性能报告失败: {e}")
            return ""
    
    def _generate_html_report(self, df: pd.DataFrame) -> str:
        """生成HTML报告"""
        report_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>DeadCodeVisitor 性能基准测试报告</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                table {{ border-collapse: collapse; width: 100%; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f2f2f2; }}
                .summary {{ background-color: #e7f3fe; padding: 10px; margin-bottom: 20px; }}
            </style>
        </head>
        <body>
            <h1>DeadCodeVisitor 性能基准测试报告</h1>
            <div class="summary">
                <h2>测试概览</h2>
                <p>测试时间范围: {df['timestamp'].min()} 至 {df['timestamp'].max()}</p>
                <p>总测试次数: {len(df)}</p>
                <p>覆盖数据集规模: {df['dataset_size'].unique()}</p>
            </div>
            
            <h2>详细性能数据</h2>
            <table>
                <thead>
                    <tr>
                        <th>时间戳</th>
                        <th>数据集规模</th>
                        <th>执行时间(s)</th>
                        <th>峰值内存(MB)</th>
                        <th>平均CPU使用率(%)</th>
                        <th>文件数量</th>
                        <th>代码行数</th>
                        <th>死代码数量</th>
                        <th>错误数量</th>
                    </tr>
                </thead>
                <tbody>
        """
        
        for _, row in df.iterrows():
            report_html += f"""
                    <tr>
                        <td>{row['timestamp']}</td>
                        <td>{row['dataset_size']}</td>
                        <td>{row['execution_time']:.2f}</td>
                        <td>{row['peak_memory_usage']:.2f}</td>
                        <td>{row['average_cpu_usage']:.2f}</td>
                        <td>{row['file_count']}</td>
                        <td>{row['line_count']}</td>
                        <td>{row['dead_code_count']}</td>
                        <td>{row['error_count']}</td>
                    </tr>
            """
        
        report_html += """
                </tbody>
            </table>
        </body>
        </html>
        """
        
        return report_html
    
    def cleanup_old_results(self, days_to_keep: int = 30) -> None:
        """清理旧的测试结果"""
        cutoff_time = datetime.now().timestamp() - (days_to_keep * 24 * 60 * 60)
        
        for result_file in self.results_path.glob("performance_*.json"):
            if result_file.stat().st_mtime < cutoff_time:
                try:
                    result_file.unlink()
                    self.logger.info(f"删除旧结果文件: {result_file}")
                except Exception as e:
                    self.logger.error(f"删除文件失败 {result_file}: {e}")
    
    def validate_test_environment(self) -> Dict[str, Any]:
        """验证测试环境"""
        validation_result = {
            "python_version": True,
            "memory_available": True,
            "disk_space": True,
            "dependencies": True
        }
        
        # 检查Python版本
        import sys
        if sys.version_info < (3, 8):
            validation_result["python_version"] = False
        
        # 检查内存
        memory = psutil.virtual_memory()
        if memory.available < 1024 * 1024 * 1024:  # 1GB
            validation_result["memory_available"] = False
        
        # 检查磁盘空间
        disk = psutil.disk_usage(self.base_path)
        if disk.free < 100 * 1024 * 1024:  # 100MB
            validation_result["disk_space"] = False
        
        # 检查依赖
        try:
            import memory_profiler
            import pandas as psutil
            import psutil
        except ImportError:
            validation_result["dependencies"] = False
        
        return validation_result


# 全局数据管理器实例
data_manager = DataManager()