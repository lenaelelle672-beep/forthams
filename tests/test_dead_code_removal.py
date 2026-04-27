import os
import time
import tempfile
import shutil
from typing import Dict, List, Any
from unittest.mock import patch
import pytest
import psutil
import memory_profiler
from ast_dead_code_check import DeadCodeVisitor, analyze_with_ast, get_daemon

class BenchmarkDataGenerator:
    """生成不同规模的代码库测试数据"""
    
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()
        
    def generate_small_project(self) -> str:
        """生成小型项目 (<1K行)"""
        project_path = os.path.join(self.temp_dir, "small_project")
        os.makedirs(project_path, exist_ok=True)
        
        # 生成主模块
        main_code = '''
def main():
    print("Hello World")
    unused_function()

def unused_function():
    """这个函数应该被被识别为死代码"""
    pass

if __name__ == "__main__":
    main()
'''
        with open(os.path.join(project_path, "main.py"), "w") as f:
            f.write(main_code)
            
        return project_path
    
    def generate_medium_project(self) -> str:
        """生成中型项目 (1K-10K行)"""
        project_path = os.path.join(self.temp_dir, "medium_project")
        os.makedirs(project_path, exist_ok=True)
        
        # 生成多个模块
        modules = []
        for i in range(10):
            module_code = f'''
def module_function_{i}():
    """模块函数 {i}"""
    return f"result_{i}"

def unused_module_function_{i}():
    """死代码函数 {i}"""
    pass

class ModuleClass_{i}:
    def used_method(self):
        return "used"
    
    def unused_method(self):
        """死代码方法"""
        pass
'''
            modules.append((f"module_{i}.py", module_code))
        
        # 生成主模块
        main_code = '''
import module_0
import module_1
import module_2

def main():
    module_0.module_function_0()
    module_1.module_function_1()
    module_2.module_function_2()

if __name__ == "__main__":
    main()
'''
        modules.append(("main.py", main_code))
        
        for filename, code in modules:
            with open(os.path.join(project_path, filename), "w") as f:
                f.write(code)
                
        return project_path
    
    def generate_large_project(self) -> str:
        """生成大型项目 (10K-100K行)"""
        project_path = os.path.join(self.temp_dir, "large_project")
        os.makedirs(project_path, exist_ok=True)
        
        # 生成多个包
        for pkg in range(5):
            pkg_path = os.path.join(project_path, f"package_{pkg}")
            os.makedirs(pkg_path, exist_ok=True)
            
            # 每个包包含多个模块
            for mod in range(20):
                module_code = f'''
def used_function_{pkg}_{mod}():
    """使用的函数"""
    return f"package_{pkg}_module_{mod}"

def unused_function_{pkg}_{mod}():
    """死代码函数"""
    pass

class UsedClass_{pkg}_{mod}:
    def used_method(self):
        return "used"

class UnusedClass_{pkg}_{mod}:
    def unused_method(self):
        """死代码方法"""
        pass
'''
                with open(os.path.join(pkg_path, f"module_{mod}.py"), "w") as f:
                    f.write(module_code)
        
        # 生成主模块
        main_code = '''
from package_0.module_0 import used_function_0_0
from package_1.module_1 import used_function_1_1
from package_2.module_2 import used_function_2_2
from package_3.module_3 import used_function_3_3
from package_4.module_4 import used_function_4_4

def main():
    used_function_0_0()
    used_function_1_1()
    used_function_2_2()
    used_function_3_3()
    used_function_4_4()

if __name__ == "__main__":
    main()
'''
        with open(os.path.join(project_path, "main.py"), "w") as f:
            f.write(main_code)
            
        return project_path
    
    def generate_xlarge_project(self) -> str:
        """生成超大型项目 (>100K行)"""
        project_path = os.path.join(self.temp_dir, "xlarge_project")
        os.makedirs(project_path, exist_ok=True)
        
        # 生成多个子项目
        for sub in range(10):
            sub_path = os.path.join(project_path, f"subproject_{sub}")
            os.makedirs(sub_path, exist_ok=True)
            
            # 每个子项目包含多个包
            for pkg in range(10):
                pkg_path = os.path.join(sub_path, f"package_{pkg}")
                os.makedirs(pkg_path, exist_ok=True)
                
                # 每个包包含多个模块
                for mod in range(10):
                    module_code = f'''
def used_function_{sub}_{pkg}_{mod}():
    """使用的函数"""
    return f"sub_{sub}_pkg_{pkg}_mod_{mod}"

def unused_function_{sub}_{pkg}_{mod}():
    """死代码函数"""
    pass

def another_unused_function_{sub}_{pkg}_{mod}():
    """另一个死代码函数"""
    pass

class UsedClass_{sub}_{pkg}_{mod}:
    def used_method(self):
        return "used"

class UnusedClass_{sub}_{pkg}_{mod}:
    defdef unused_method(self):
        """死代码方法"""
        pass

class AnotherUnusedClass_{sub}_{pkg}_{mod}:
    def another_unused_method(self):
        """另一个死代码方法"""
        pass
'''
                    with open(os.path.join(pkg_path, f"module_{mod}.py"), "w") as f:
                        f.write(module_code)
        
        # 生成主模块
        main_code = '''
from subproject_0.package_0.module_0 import used_function_0_0_0
from subproject_1.package_1.module_1 import used_function_1_1_1
from subproject_2.package_2.module_2 import used_function_2_2_2
from subproject_3.package_3.module_3 import used_function_3_3_3
from subproject_4.package_4.module_4 import used_function_4_4_4

def main():
    used_function_0_0_0()
    used_function_1_1_1()
    used_function_2_2_2()
    used_function_3_3_3()
    used_function_4_4_4()

if __name__ == "__main__":
    main()
'''
        with open(os.path.join(project_path, "main.py"), "w") as f:
            f.write(main_code)
            
        return projectproject_path
    
    def cleanup(self):
        """清理临时文件"""
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)


class PerformanceCollector:
    """性能数据收集器"""
    
    def __init__(self):
        self.metrics = {}
        
    def collect_memory_usage(self, func, *args, **kwargs):
        """收集内存使用情况"""
        mem_usage = memory_profiler.memory_usage((func, args, kwargs), interval=0.1)
        return {
            'peak_memory': max(mem_usage),
            'avg_memory': sum(mem_usage) / len(mem_usage),
            'memory_profile': mem_usage
        }
    
    def collect_time_metrics(self, func, *args, **kwargs):
        """收集时间指标"""
        start_time = time.time()
        start_cpu = time.process_time()
        
        result = func(*args, **kwargs)
        
        end_time = time.time()
        end_cpu = time.process_time()
        
        return {
            'wall_time': end_time - start_time,
            'cpu_time': end_cpu - start_cpu,
            'result': result
        }
    
    def collect_system_metrics(self):
        """收集系统资源使用情况"""
        process = psutil.Process()
        return {
            'cpu_percent': process.cpu_percent(),
            'memory_rss': process.memory_info().rss / 1024 / 1024,  # MB
            'memory_vms': process.memory_info().vms / 1024 / 1024,  # MB
            'num_threads': process.num_threads(),
            'open_files': len(process.open_files())
        }


class BenchmarkFramework:
    """基准测试框架"""
    
    def __init__(self):
        self.data_generator = BenchmarkDataGenerator()
        self.collector = PerformanceCollector()
        self.results = {}
        
    def setup_test_projects(self):
        """设置测试项目"""
        self.projects = {
            'small': self.data_generator.generate_small_project(),
            'medium': self.data_generator.generate_medium_project(),
            'large': self.data_generator.generate_large_project(),
            'xlarge': self.data_generator.generate_xlarge_project()
        }
        
        # 计算项目规模
        self.project_sizes = {}
        for name, path in self.projects.items():
            total_lines = 0
            for root, _, files in os.walk(path):
                for file in files:
                    with open(os.path.join(root, file), 'r') as f:
                        total_lines += len(f.readlines())
g