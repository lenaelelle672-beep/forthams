"""
基准测试场景生成器

用于生成不同规模代码库的测试场景，支持性能基准测试。
"""

import os
import json
import time
import random
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from enum import Enum
import tempfile
import shutil
from pathlib import Path


class CodeScale(Enum):
    """代码库规模分类"""
    SMALL = "small"      # < 1K 行
    MEDIUM = "medium"    # 1K-10K 行
    LARGE = "large"      # 10K-100K 行
    EXTRA_LARGE = "xlarge"  # > 100K 行


@dataclass
class ScenarioConfig:
    """测试场景配置"""
    name: str
    scale: CodeScale
    target_lines: int
    module_count: int
    function_count: int
    class_count: int
    dead_code_ratio: float  # 死代码比例
    complexity_level: int   # 复杂度级别 (1-10)
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PerformanceMetrics:
    """性能指标数据"""
    execution_time: float
    peak_memory_usage: float
    average_cpu_usage: float
    total_lines_analyzed: int
    dead_code_count: int
    nodes_count: int
    edges_count: int
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ScenarioGenerator:
    """基准测试场景生成器"""
    
    def __init__(self, base_dir: str = None):
        self.base_dir = base_dir or tempfile.mkdtemp(prefix="benchmark_scenario_")
        self.scenarios_dir = os.path.join(self.base_dir, "scenarios")
        self.results_dir = os.path.join(self.base_dir, "results")
        
        # 确保目录存在
        os.makedirs(self.scenarios_dir, exist_ok=True)
        os.makedirs(self.results_dir, exist_ok=True)
        
        # 预定义的模板代码片段
        self.templates = {
            "simple_function": [
                "def simple_function():",
                "    return True",
                "",
            ],
            "complex_function": [
                "def complex_function(param1, param2, **kwargs):",
                "    \"\"\"Complex function with multiple branches\"\"\"",
                "    if param1 > 0:",
                "        result = param1 * 2",
                "        for i in range(param2):",
                "            result += i",
                "        if 'extra' in kwargs:",
                "            result += kwargs['extra']",
                "    else:",
                "        result = 0",
                "    return result",
                "",
            ],
            "empty_function": [
                "def empty_function():",
                "    pass",
                "",
            ],
            "simple_class": [
                "class SimpleClass:",
                "    def __init__(self, value):",
                "        self.value = value",
                "    ",
                "    def get_value(self):",
                "        return self.value",
                "",
            ],
            "complex_class": [
                "class ComplexClass:",
                "    def __init__(self, data):",
                "        self.data = data",
                "        self._cache = {}",
                "    ",
                "    def process_data(self):",
                "        \"\"\"Process the data with complex logic\"\"\"",
                "        if not self.data:",
                "            return None",
                "        ",
                "        result = []",
                "        for item in self.data:",
                "            if item.get('active', False):",
                "                processed = self._transform_item(item)",
                "                result.append(processed)",
                "        ",
                "        return result",
                "    ",
                "    def _transform_item(self, item):",
                "        \"\"\"Internal transformation method\"\"\"",
                "        return {",
                "            'id': item.get('id'),",
                "            'name': item.get('name', '').upper(),",
                "            'value': item.get('value', 0) * 2",
                "        }",
                "",
            ],
            "empty_class": [
                "class EmptyClass:",
                "    pass",
                "",
            ],
            "import_statement": [
                "import os",
                "import sys",
                "from typing import List, Dict, Optional",
                "",
            ],
            "dead_code_function": [
                "def dead_code_function():",
                "    # This function should be detected as dead code",
                "    unused_variable = 42",
                "    another_unused = 'test'",
                "    return None  # Return value is never used",
                "",
            ],
        }
    
    def generate_scenario(self, config: ScenarioConfig) -> str:
        """生成测试场景代码"""
        scenario_path = os.path.join(self.scenarios_dir, f"{config.name}_{config.scale.value}")
        os.makedirs(scenario_path, exist_ok=True)
        
        # 生成主模块文件
        main_file = os.path.join(scenario_path, "main.py")
        with open(main_file, 'w', encoding='utf-8') as f:
            f.write(self._generate_main_module(config))
        
        # 生成子模块文件
        for i in range(config.module_count - 1):  # 减1因为main.py已经是一个模块
            module_file = os.path.join(scenario_path, f"module_{i}.py")
            with open(module_file, 'w', encoding='utf-8') as f:
                f.write(self._generate_module(config, i))
        
        # 生成 __init__.py 文件
        init_file = os.path.join(scenario_path, "__init__.py")
        with open(init_file, 'w', encoding='utf-8') as f:
            f.write("# Generated benchmark scenario\n")
        
        return scenario_path
    
    def _generate_main_module(self, config: ScenarioConfig) -> str:
        """生成主模块代码"""
        lines = []
        
        # 添加导入语句
        lines.extend(self.templates["import_statement"])
        lines.append("")
        
        # 添加类定义
        for i in range(config.class_count):
            if config.complexity_level >= 7:
                lines.extend(self.templates["complex_class"])
            elif config.complexity_level >= 4:
                lines.extend(self.templates["simple_class"])
            else:
                lines.extend(self.templates["empty_class"])
        
        # 添加函数定义
        for i in range(config.function_count):
            if config.complexity_level >= 8:
                lines.extend(self.templates["complex_function"])
            elif config.complexity_level >= 3:
                lines.extend(self.templates["simple_function"])
            else:
                lines.extend(self.templates["empty_function"])
        
        # 添加死代码
        dead_code_count = int(config.function_count * config.dead_code_ratio)
        for i in range(dead_code_count):
            lines.extend(self.templates["dead_code_function"])
        
        return "\n".join(lines)
    
    def _generate_module(self, config: ScenarioConfig, module_index: int) -> str:
        """生成子模块代码"""
        lines = []
        
        # 模块特定的导入
        lines.append(f"# Module {module_index}")
        lines.extend(self.templates["import_statement"])
        lines.append("")
        
        # 根据模块索引调整内容
        class_count = max(1, config.class_count // config.module_count)
        function_count = max(1, config.function_count // config.module_count)
        
        # 添加类定义
        for i in range(class_count):
            if config.complexity_level >= 6:
                lines.extend(self.templates["complex_class"])
            else:
                lines.extend(self.templates["simple_class"])
        
        # 添加函数定义
        for i in range(function_count):
            if config.complexity_level >= 5:
                lines.extend(self.templates["complex_function"])
            else:
                lines.extend(self.templates["simple_function"])
        
        # 添加一些死代码
        if config.dead_code_ratio > 0.1:
            lines.extend(self.templates["dead_code_function"])
        
        return "\n".join(lines)
    
    def get_predefined_scenarios(self) -> List[ScenarioConfig]:
        """获取预定义的测试场景"""
        scenarios = [
            # 小型代码库
            ScenarioConfig(
                name="small_simple",
                scale=CodeScale.SMALL,
                target_lines=500,
                module_count=1,
                function_count=10,
                class_count=3,
                dead_code_ratio=0.1,
                complexity_level=2
            ),
            ScenarioConfig(
                name="small_complex",
                scale=CodeScale.SMALL,
                target_lines=800,
                module_count=2,
                function_count=15,
                class_count=5,
                dead_code_ratio=0.2,
                complexity_level=5
            ),
            
            # 中型代码库
            ScenarioConfig(
                name="medium_simple",
                scale=CodeScale.MEDIUM,
                target_lines=3000,
                module_count=5,
                function_count=50,
                class_count=15,
                dead_code_ratio=0.15,
                complexity_level=4
            ),
            ScenarioConfig(
                name="medium_complex",
                scale=CodeScale.MEDIUM,
                target_lines=8000,
                module_count=8,
                function_count=80,
                class_count=25,
                dead_code_ratio=0.25,
                complexity_level=7
            ),
            
            # 大型代码库
            ScenarioConfig(
                name="large_simple",
                scale=CodeScale.LARGE,
                target_lines=20000,
                module_count=15,
                function_count=200,
                class_count=60,
                dead_code_ratio=0.2,
                complexity_level=5
            ),
            ScenarioConfig(
                name="large_complex",
                scale=CodeScale.LARGE,
                target_lines=80000,
                module_count=25,
                function_count=400,
                class_count=120,
                dead_code_ratio=0.3,
                complexity_level=8
            ),
            
            # 超大型代码库
            ScenarioConfig(
                name="xlarge_simple",
                scale=CodeScale.EXTRA_LARGE,
                target_lines=150000,
                module_count=40,
                function_count=800,
                class_count=200,
                dead_code_ratio=0.25,
                complexity_level=6
            ),
            ScenarioConfig(
                name="xlarge_complex",
                scale=CodeScale.EXTRA_LARGE,
                target_lines=300000,
                module_count=60,
                function_count=1500,
                class_count=400,
                dead_code_ratio=0.35,
                complexity_level=9
            ),
        ]
        
        return scenarios
    
    def count_lines(self, file_path: str) -> int:
        """统计文件行数"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return len(f.readlines())
        except:
            return 0
    
    def analyze_scenario(self, scenario_path: str) -> Dict[str, int]:
        """分析生成的场景"""
        total_lines = 0
        total_files = 0
        
        for root, dirs, files in os.walk(scenario_path):
            for file in files:
                if file.endswith('.py'):
                    file_path = os.path.join(root, file)
                    total_lines += self.count_lines(file_path)
                    total_files += 1
        
        return {
            "total_lines": total_lines,
            "total_files": total_files,
            "estimated_functions": total_lines // 10,  # 估算
            "estimated_classes": total_lines // 20,   # 估算
        }
    
    def save_scenario_config(self, config: ScenarioConfig, scenario_path: str):
        """保存场景配置"""
        config_file = os.path.join(scenario_path, "scenario_config.json")
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config.to_dict(), f, indent=2, ensure_ascii=False)
    
    def save_performance_metrics(self, metrics: PerformanceMetrics, scenario_name: str):
        """保存性能指标"""
        metrics_file = os.path.join(self.results_dir, f"{scenario_name}_metrics.json")
        with open(metrics_file, 'w', encoding='utf-8') as f:
            json.dump(metrics.to_dict(), f, indent=2, ensure_ascii=False)
    
    def cleanup(self):
        """清理临时文件"""
        if os.path.exists(self.base_dir):
            shutil.rmtree(self.base_dir)
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.cleanup()


class PerformanceCollector:
    """性能数据收集器"""
    
    def __init__(self):
        self.metrics = []
    
    def collect_metrics(self, start_time: float, end_time: float, 
                       memory_info: Dict[str, float], analysis_result: Dict[str, Any]) -> PerformanceMetrics:
        """收集性能指标"""
        execution_time = end_time - start_time
        
        metrics = PerformanceMetrics(
            execution_time=execution_time,
            peak_memory_usage=memory_info.get('peak', 0),
            average_cpu_usage=memory_info.get('cpu', 0),
            total_lines_analyzed=analysis_result.get('total_lines', 0),
            dead_code_count=analysis_result.get('dead_code_count', 0),
            nodes_count=analysis_result.get('nodes_count', 0),
            edges_count=analysis_result.get('edges_count', 0)
        )
        
        self.metrics.append(metrics)
        return metrics
    
    def get_summary(self) -> Dict[str, Any]:
        """获取性能摘要"""
        if not self.metrics:
            return {}
        
        total_time = sum(m.execution_time for m in self.metrics)
        avg_time = total_time / len(self.metrics)
        avg_memory = sum(m.peak_memory_usage for m in self.metrics) / len(self.metrics)
        
        return {
            "total_scenarios": len(self.metrics),
            "total_execution_time": total_time,
            "average_execution_time": avg_time,
            "average_peak_memory": avg_memory,
            "min_execution_time": min(m.execution_time for m in self.metrics),
            "max_execution_time": max(m.execution_time for m in self.metrics),
        }


def generate_benchmark_scenarios(output_dir: str = None) -> List[str]:
    """生成所有基准测试场景"""
    if output_dir is None:
        output_dir = tempfile.mkdtemp(prefix="benchmark_scenarios_")
    
    scenarios = []
    
    with ScenarioGenerator(output_dir) as generator:
        predefined_scenarios = generator.get_predefined_scenarios()
        
        for config in predefined_scenarios:
            print(f"Generating scenario: {config.name}")
            scenario_path = generator.generate_scenario(config)
            generator.save_scenario_config(config, scenario_path)
            
            # 分析生成的场景
            analysis = generator.analyze_scenario(scenario_path)
            print(f"  Generated: {analysis['total_lines']} lines, {analysis['total_files']} files")
            
            scenarios.append(scenario_path)
    
    return scenarios


if __name__ == "__main__":
    # 示例用法
    scenarios = generate_benchmark_scenarios()
    print(f"Generated {len(scenarios)} benchmark scenarios")
    for scenario in scenarios:
        print(f"  - {scenario}")