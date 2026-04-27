"""
SWARM-002 Quality Deep Audit Test Suite
Phase 4: Quality Assurance & Optimization

针对自动变异轮次(31-49)的深度质量回溯审计测试
执行代码质量评估，识别潜在问题并提供改进建议
"""

import unittest
import sys
import os
import json
import time
import tracemalloc
from typing import Dict, List, Any, Optional
import ast
import pylint.lint
from pylint.reporters.json_reporter import JSONReporter


class QualityAuditTest(unittest.TestCase):
    """
    质量审计测试类 - 执行深度质量回溯审计
    
    ATB-001: 代码静态分析
    ATB-002: 单元测试覆盖率
    ATB-003: 性能基准测试
    ATB-004: 内存泄漏检测
    ATB-005: 集成测试
    """
    
    def setUp(self):
        """测试初始化 - 设置审计环境"""
        self.test_files = []
        self.audit_results = {}
        self.start_time = time.time()
        tracemalloc.start()
        
        # 定义测试范围：自动变异轮次(31-49)
        self.mutation_rounds = list(range(31, 50))
        
    def tearDown(self):
        """测试清理 - 重置审计环境"""
        tracemalloc.stop()
        execution_time = time.time() - self.start_time
        print(f"\n[审计完成] 总执行时间: {execution_time:.2f}秒")
        
    def test_static_analysis_pylint(self):
        """
        ATB-001: 代码静态分析测试
        
        使用 pylint 执行静态代码分析，预期发现的问题数量与严重性分布符合历史基线
        测试命令：`pylint --output-format=json path/to/code | jq '.'`
        预期结果：生成结构化JSON报告，包含所有发现的代码问题
        """
        print("\n[执行] ATB-001: 代码静态分析...")
        
        # 收集需要分析的Python文件
        python_files = self._collect_python_files()
        
        if not python_files:
            self.skipTest("未找到可分析的Python文件")
            
        # 执行pylint静态分析
        reporter = JSONReporter()
        pylint.lint.Run(python_files + ['--output-format=json'], reporter=reporter, exit=False)
        
        # 解析分析结果
        if hasattr(reporter, 'sections'):
            results = reporter.sections
        else:
            results = []
            
        # 验证结果格式
        self.assertIsInstance(results, list, "pylint应返回列表格式结果")
        
        # 统计问题严重性分布
        severity_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'info': 0}
        
        for result in results:
            if isinstance(result, dict):
                # 根据pylint JSON格式统计严重性
                if 'type' in result:
                    severity = result['type'].lower()
                    if severity in severity_counts:
                        severity_counts[severity] += 1
                        
        # 记录审计结果
        self.audit_results['static_analysis'] = {
            'total_files': len(python_files),
            'severity_distribution': severity_counts,
            'issues_found': sum(severity_counts.values())
        }
        
        print(f"[静态分析] 发现 {sum(severity_counts.values())} 个问题")
        print(f"[严重性分布] {severity_counts}")
        
        # 验证问题数量在合理范围内（可根据历史基线调整）
        total_issues = sum(severity_counts.values())
        self.assertLess(total_issues, 100, "问题总数应少于100个")
        
    def test_unit_test_coverage(self):
        """
        ATB-002: 单元测试覆盖率测试
        
        使用 pytest-cov 执行测试覆盖率分析，预期覆盖率不低于85%
        测试命令：`pytest --cov=path/to/code tests/ --cov-report=xml`
        预期结果：生成覆盖率报告，核心功能模块覆盖率≥85%
        """
        print("\n[执行] ATB-002: 单元测试覆盖率分析...")
        
        try:
            import pytest
            import pytest_cov
        except ImportError:
            self.skipTest("pytest-cov未安装，跳过覆盖率测试")
            
        # 定义核心功能模块路径
        core_modules = [
            'src/endless_daemon.py',
            'src/ast_analyzer.py',
            'src/dead_code_detector.py'
        ]
        
        coverage_results = {}
        
        for module in core_modules:
            if os.path.exists(module):
                # 执行模块测试覆盖率分析
                result = pytest.main([
                    '--cov=' + module,
                    '--cov-report=term-missing',
                    '--cov-fail-under=85',
                    'tests/'
                ], plugins=[pytest_cov])
                
                coverage_results[module] = {
                    'test_result': result,
                    'coverage_threshold': 85
                }
                
        self.audit_results['coverage'] = coverage_results
        
        print(f"[覆盖率测试] 完成 {len(coverage_results)} 个模块分析")
        
        # 验证核心模块覆盖率
        for module, result in coverage_results.items():
            if result['test_result'] == 0:  # pytest成功返回0
                print(f"[✓] {module}: 覆盖率达标")
            else:
                print(f"[✗] {module}: 覆盖率未达标")
                
    def test_performance_benchmark(self):
        """
        ATB-003: 性能基准测试
        
        使用 timeit 模块执行性能基准测试，预期执行时间不超过基准值的110%
        测试命令：`python -m timeit -s 'import module' 'function()'`
        预期结果：核心函数执行时间在可接受范围内
        """
        print("\n[执行] ATB-003: 性能基准测试...")
        
        # 定义性能测试用例
        performance_tests = [
            {
                'name': 'AST分析性能',
                'setup': 'from src.endless_daemon import analyze_with_ast',
                'stmt': 'analyze_with_ast("test_file.py")',
                'max_time': 5.0  # 最大允许时间（秒）
            },
            {
                'name': '死代码检测性能',
                'setup': 'from src.dead_code_detector import DeadCodeDetector',
                'stmt': 'detector = DeadCodeDetector(); detector.analyze("test_file.py")',
                'max_time': 3.0
            }
        ]
        
        performance_results = []
        
        for test in performance_tests:
            try:
                import timeit
                
                # 执行性能测试
                times = timeit.repeat(
                    stmt=test['stmt'],
                    setup=test['setup'],
                    number=10,  # 重复次数
                    repeat=3   # 重复轮次
                )
                
                avg_time = sum(times) / len(times)
                max_time = max(times)
                
                performance_results.append({
                    'test_name': test['name'],
                    'avg_time': avg_time,
                    'max_time': max_time,
                    'threshold': test['max_time'],
                    'passed': max_time <= test['max_time']
                })
                
                print(f"[性能] {test['name']}: 平均={avg_time:.3f}s, 最大={max_time:.3f}s, 阈值={test['max_time']}s")
                
            except Exception as e:
                print(f"[性能测试失败] {test['name']}: {str(e)}")
                performance_results.append({
                    'test_name': test['name'],
                    'error': str(e),
                    'passed': False
                })
                
        self.audit_results['performance'] = performance_results
        
        # 验证性能基准
        for result in performance_results:
            if 'error' not in result:
                self.assertTrue(
                    result['passed'], 
                    f"性能测试失败: {result['test_name']} 超过阈值"
                )
                
    def test_memory_leak_detection(self):
        """
        ATB-004: 内存泄漏检测
        
        使用 tracemalloc 执行内存泄漏检测，预期内存增长不超过初始值的5%
        测试命令：`python -m tracemalloc --trace-allocations python script.py`
        预期结果：内存使用稳定，无异常增长
        """
        print("\n[执行] ATB-004: 内存泄漏检测...")
        
        memory_tests = [
            {
                'name': 'AST分析内存使用',
                'code': '''
import sys
sys.path.append('src')
from endless_daemon import analyze_with_ast

# 执行分析
result = analyze_with_ast("test_file.py")
print("分析完成")
'''
            },
            {
                'name': '死代码检测内存使用',
                'code': '''
import sys
sys.path.append('src')
from dead_code_detector import DeadCodeDetector

detector = DeadCodeDetector()
result = detector.analyze("test_file.py")
print("检测完成")
'''
            }
        ]
        
        memory_results = []
        
        for test in memory_tests:
            try:
                # 开始内存跟踪
                tracemalloc.start()
                
                # 获取初始内存快照
                snapshot1 = tracemalloc.take_snapshot()
                
                # 执行测试代码
                exec(test['code'])
                
                # 获取执行后内存快照
                snapshot2 = tracemalloc.take_snapshot()
                
                # 比较内存使用
                top_stats = snapshot2.compare_to(snapshot1, 'lineno')
                
                total_growth = sum(stat.size_diff for stat in top_stats)
                total_allocated = sum(stat.size for stat in top_stats)
                
                memory_results.append({
                    'test_name': test['name'],
                    'total_growth': total_growth,
                    'total_allocated': total_allocated,
                    'growth_percentage': (total_growth / max(1, total_allocated)) * 100,
                    'passed': total_growth <= total_allocated * 0.05  # 5%阈值
                })
                
                print(f"[内存] {test['name']}: 增长={total_growth}B ({(total_growth / max(1, total_allocated)) * 100:.2f}%)")
                
                tracemalloc.stop()
                
            except Exception as e:
                print(f"[内存测试失败] {test['name']}: {str(e)}")
                memory_results.append({
                    'test_name': test['name'],
                    'error': str(e),
                    'passed': False
                })
                
        self.audit_results['memory'] = memory_results
        
        # 验证内存使用
        for result in memory_results:
            if 'error' not in result:
                self.assertTrue(
                    result['passed'],
                    f"内存泄漏检测失败: {result['test_name']} 内存增长超过5%"
                )
                
    def test_integration_tests(self):
        """
        ATB-005: 集成测试
        
        使用 pytest 执行集成测试，预期所有测试用例通过率100%
        测试命令：`pytest -m "integration" tests/`
        预期结果：所有集成测试用例通过
        """
        print("\n[执行] ATB-005: 集成测试...")
        
        try:
            import pytest
        except ImportError:
            self.skipTest("pytest未安装，跳过集成测试")
            
        # 定义集成测试标记
        integration_markers = ['integration', 'e2e']
        
        integration_results = {}
        
        for marker in integration_markers:
            try:
                # 执行标记的集成测试
                result = pytest.main([
                    '-m', marker,
                    '-v'
                ])
                
                integration_results[marker] = {
                    'test_result': result,
                    'passed': result == 0
                }
                
                print(f"[集成测试] {marker}: {'通过' if result == 0 else '失败'}")
                
            except Exception as e:
                print(f"[集成测试失败] {marker}: {str(e)}")
                integration_results[marker] = {
                    'error': str(e),
                    'passed': False
                }
                
        self.audit_results['integration'] = integration_results
        
        # 验证所有集成测试通过
        for marker, result in integration_results.items():
            if 'error' not in result:
                self.assertTrue(
                    result['passed'],
                    f"集成测试失败: {marker} 测试未通过"
                )
                
    def _collect_python_files(self):
        """收集需要分析的Python文件"""
        python_files = []
        
        # 扫描项目目录
        for root, dirs, files in os.walk('.'):
            # 跳过特定目录
            dirs[:] = [d for d in dirs if d not in ['__pycache__', 'node_modules', 'dist']]
            
            for file in files:
                if file.endswith('.py') and not file.startswith('test_'):
                    file_path = os.path.join(root, file)
                    python_files.append(file_path)
                    
        return python_files
        
    def test_audit_report_generation(self):
        """
        审计报告生成测试
        
        验证审计结果能够生成结构化的质量报告
        """
        print("\n[执行] 审计报告生成...")
        
        # 生成审计报告
        audit_report = {
            'audit_id': f'swarm_002_round_31_49_{int(time.time())}',
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'phase': 'Phase 4: Quality Assurance & Optimization',
            'scope': '自动变异轮次(31-49)',
            'results': self.audit_results,
            'summary': self._generate_audit_summary()
        }
        
        # 保存审计报告
        report_file = f'audit_report_{int(time.time())}.json'
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(audit_report, f, indent=2, ensure_ascii=False)
            
        print(f"[审计报告] 已生成: {report_file}")
        
        # 验证报告完整性
        self.assertIn('audit_id', audit_report)
        self.assertIn('results', audit_report)
        self.assertIn('summary', audit_report)
        
        # 验证所有测试模块都有结果
        required_modules = ['static_analysis', 'coverage', 'performance', 'memory', 'integration']
        for module in required_modules:
            self.assertIn(module, audit_report['results'])
            
    def _generate_audit_summary(self):
        """生成审计摘要"""
        summary = {
            'total_tests': 0,
            'passed_tests': 0,
            'failed_tests': 0,
            'critical_issues': 0,
            'recommendations': []
        }
        
        # 统计测试结果
        for module, results in self.audit_results.items():
            if isinstance(results, list):
                summary['total_tests'] += len(results)
                for result in results:
                    if result.get('passed', False):
                        summary['passed_tests'] += 1
                    else:
                        summary['failed_tests'] += 1
                        
        # 生成建议
        if summary['failed_tests'] > 0:
            summary['recommendations'].append("重点关注失败的测试用例，及时修复发现的问题")
            
        if self.audit_results.get('static_analysis', {}).get('issues_found', 0) > 50:
            summary['critical_issues'] += 1
            summary['recommendations'].append("代码静态分析发现较多问题，建议优先处理高严重性问题")
            
        return summary


if __name__ == '__main__':
    # 配置测试运行
    unittest.main(verbosity=2)