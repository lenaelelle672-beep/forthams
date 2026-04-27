@@ create regression detector for performance baseline tracking
import json
import time
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np


class PerformanceRegressionDetector:
    """
    性能回归检测器 - 用于检测 DeadCodeVisitor 性能退化
    """
    
    def __init__(self, baseline_file: str = "performance_baseline.json"):
        self.baseline_file = Path(baseline_file)
        self.baseline_data = self._load_baseline()
        
    def _load_baseline(self) -> Dict[str, Any]:
        """加载性能基线数据"""
        if self.baseline_file.exists():
            with open(self.baseline_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
        
    def _save_baseline(self):
        """保存性能基线数据"""
        with open(self.baseline_file, 'w', encoding='utf-8') as f:
            json.dump(self.baseline_data, f, indent=2, ensure_ascii=False)
            
    def record_performance(self, test_name: str, metrics: Dict[str, float]):
        """
        记录性能指标
        Args:
            test_name: 测试名称
            metrics: 性能指标字典，包含时间、内存等
        """
        timestamp = datetime.now().isoformat()
        
        if test_name not in self.baseline_data:
            self.baseline_data[test_name] = []
            
        self.baseline_data[test_name].append({
            'timestamp': timestamp,
            'metrics': metrics
        })
        
        self._save_baseline()
        
    def detect_regression(self, test_name: str, current_metrics: Dict[str, float], 
                         threshold: float = 0.2) -> Dict[str, Any]:
        """
        检测性能回归
        Args:
            test_name: 测试名称
            current_metrics: 当前性能指标
            threshold: 退化阈值 (20%)
        Returns:
            包含回归检测结果的字典
        """
        results = {
            'has_regression': False,
            'regressions': {},
            'baseline': None,
            'current': current_metrics
        }
        
        if test_name not in self.baseline_data or not self.baseline_data[test_name]:
            return results
            
        # 获取最近的基线数据
        baseline_entry = self.baseline_data[test_name][-1]
        results['baseline'] = baseline_entry['metrics']
        
        # 比较每个指标
        for metric_name, current_value in current_metrics.items():
            if metric_name in baseline_entry['metrics']:
                baseline_value = baseline_entry['metrics'][metric_name]
                change_ratio = (current_value - baseline_value) / baseline_value
                
                if abs(change_ratio) > threshold:
                    results['has_regression'] = True
                    results['regressions'][metric_name] = {
                        'baseline': baseline_value,
                        'current': current_value,
                        'change_ratio': change_ratio,
                        'change_percent': change_ratio * 100
                    }
                    
        return results
        
    def generate_report(self, output_file: str = "performance_report.html"):
        """
        生成性能报告
        Args:
            output_file: 输出文件路径
        """
        html_content = self._generate_html_report()
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
            
    def _generate_html_report(self) -> str:
        """生成HTML格式的性能报告"""
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>DeadCodeVisitor 性能报告</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .metric { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
                .regression { background-color: #ffebee; }
                .improvement { background-color: #e8f5e8; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>DeadCodeVisitor 性能报告</h1>
            <p>生成时间: {}</p>
        """.format(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        
        for test_name, entries in self.baseline_data.items():
            if not entries:
                continue
                
            html += f"<h2>{test_name}</h2>"
            html += "<table>"
            html += "<tr><th>时间</th><th>执行时间(s)</th><th>内存使用(MB)</th><th>节点数</th></tr>"
            
            for entry in entries[-10:]:  # 显示最近10条记录
                metrics = entry['metrics']
                html += f"<tr>"
                html += f"<td>{entry['timestamp']}</td>"
                html += f"<td>{metrics.get('execution_time', 'N/A')}</td>"
                html += f"<td>{metrics.get('memory_usage', 'N/A')}</td>"
                html += f"<td>{metrics.get('node_count', 'N/A')}</td>"
                html += "</tr>"
                
            html += "</table>"
            
        html += """
        </body>
        </html>
        """
        
        return html
        
    def plot_performance_trend(self, test_name: str, metric_name: str, 
                              output_file: str = None):
        """
        绘制性能趋势图
        Args:
            test_name: 测试名称
            metric_name: 指标名称
            output_file: 输出文件路径
        """
        if test_name not in self.baseline_data:
            return
            
        entries = self.baseline_data[test_name]
        timestamps = []
        values = []
        
        for entry in entries:
            if metric_name in entry['metrics']:
                timestamps.append(datetime.fromisoformat(entry['timestamp']))
                values.append(entry['metrics'][metric_name])
                
        if not timestamps:
            return
            
        plt.figure(figsize=(12, 6))
        plt.plot(timestamps, values, marker='o', linewidth=2, markersize=4)
        plt.title(f'{test_name} - {metric_name} 趋势')
        plt.xlabel('时间')
        plt.ylabel(metric_name)
        plt.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()
        
        if output_file:
            plt.savefig(output_file, dpi=300, bbox_inches='tight')
        else:
            plt.show()
            
    def get_statistics(self, test_name: str) -> Dict[str, Any]:
        """
        获取性能统计信息
        Args:
            test_name: 测试名称
        Returns:
            统计信息字典
        """
        if test_name not in self.baseline_data:
            return {}
            
        entries = self.baseline_data[test_name]
        if not entries:
            return {}
            
        metrics_list = [entry['metrics'] for entry in entries]
        
        stats = {}
        for metric_name in metrics_list[0].keys():
            values = [entry['metrics'][metric_name] for entry in metrics_list 
                     if metric_name in entry['metrics']]
            if values:
                stats[metric_name] = {
                    'min': min(values),
                    'max': max(values),
                    'avg': sum(values) / len(values),
                    'latest': values[-1],
                    'trend': 'increasing' if values[-1] > values[0] else 'decreasing'
                }
                
        return stats
        
    def clear_history(self, test_name: str = None):
        """
        清除历史数据
        Args:
            test_name: 测试名称，如果为None则清除所有数据
        """
        if test_name:
            if test_name in self.baseline_data:
                del self.baseline_data[test_name]
        else:
            self.baseline_data.clear()
            
        self._save_baseline()
        
    def export_to_csv(self, output_file: str = "performance_data.csv"):
        """
        导出性能数据到CSV
        Args:
            output_file: 输出文件路径
        """
        import csv
        
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['test_name', 'timestamp', 'execution_time', 
                         'memory_usage', 'node_count', 'edge_count']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            
            for test_name, entries in self.baseline_data.items():
                for entry in entries:
                    row = {
                        'test_name': test_name,
                        'timestamp': entry['timestamp']
                    }
                    row.update(entry['metrics'])
                    writer.writerow(row)
                    
    def validate_performance(self, test_name: str, expected_metrics: Dict[str, float]) -> bool:
        """
        验证性能是否符合预期
        Args:
            test_name: 测试名称
            expected_metrics: 预期性能指标
        Returns:
            是否符合预期
        """
        if test_name not in self.baseline_data:
            return False
            
        latest_entry = self.baseline_data[test_name][-1]
        latest_metrics = latest_entry['metrics']
        
        for metric_name, expected_value in expected_metrics.items():
            if metric_name in latest_metrics:
                current_value = latest_metrics[metric_name]
                if current_value > expected_value * 1.1:  # 允许10%的误差
                    return False
                    
        return True
        
    def compare_baselines(self, baseline1: str, baseline2: str) -> Dict[str, Any]:
        """
        比较两个基线版本的性能
        Args:
            baseline1: 第一个基线版本
            baseline2: 第二个基线版本
        Returns:
            比较结果
        """
        if baseline1 not in self.baseline_data or baseline2 not in self.baseline_data:
            return {}
            
        entries1 = self.baseline_data[baseline1]
        entries2 = self.baseline_data[baseline2]
        
        if not entries1 or not entries2:
            return {}
            
        latest1 = entries1[-1]['metrics']
        latest2 = entries2[-1]['metrics']
        
        comparison = {}
        for metric_name in latest1.keys():
            if metric_name in latest2:
                comparison[metric_name] = {
                    'baseline1': latest1[metric_name],
                    'baseline2': latest2[metric_name],
                    'change': latest2[metric_name] - latest1[metric_name],
                    'change_percent': (latest2[metric_name] - latest1[metric_name]) / latest1[metric_name] * 100
                }
                
        return comparison
        
    def set_alert_threshold(self, test_name: str, metric_name: str, threshold: float):
        """
        设置告警阈值
        Args:
            test_name: 测试名称
            metric_name: 指标名称
            threshold: 告警阈值
        """
        if 'alert_thresholds' not in self.baseline_data:
            self.baseline_data['alert_thresholds'] = {}
            
        if test_name not in self.baseline_data['alert_thresholds']:
            self.baseline_data['alert_thresholds'][test_name] = {}
            
        self.baseline_data['alert_thresholds'][test_name][metric_name] = threshold
        self._save_baseline()
        
    def check_alerts(self, test_name: str, current_metrics: Dict[str, float]) -> List[str]:
        """
        检查是否触发告警
        Args:
            test_name: 测试名称
            current_metrics: 当前性能指标
        Returns:
            告警消息列表
        """
        alerts = []
        
        if 'alert_thresholds' not in self.baseline_data:
            return alerts
            
        if test_name not in self.baseline_data['alert_thresholds']:
            return alerts
            
        thresholds = self.baseline_data['alert_thresholds'][test_name]
        
        for metric_name, threshold in thresholds.items():
            if metric_name in current_metrics:
                current_value = current_metrics[metric_name]
                if current_value > threshold:
                    alerts.append(f"性能告警: {test_name} - {metric_name} 超过阈值 ({current_value} > {threshold})")
                    
        return alerts
        
    def get_test_history(self, test_name: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        获取测试历史记录
        Args:
            test_name: 测试名称
            limit: 返回记录数量限制
        Returns:
            历史记录列表
        """
        if test_name not in self.baseline_data:
            return []
            
        return self.baseline_data[test_name][-limit:]
        
    def get_all_tests(self) -> List[str]:
        """
        获取所有测试名称
        Returns:
            测试名称列表
        """
        return [test_name for test_name in self.baseline_data.keys() 
                if test_name != 'alert_thresholds']
        
    def get_test_summary(self, test_name: str) -> Dict[str, Any]:
        """
        获取测试摘要信息
        Args:
            test_name: 测试名称
        Returns:
            测试摘要信息
        """
        if test_name not in self.baseline_data:
            return {}
            
        entries = self.baseline_data[test_name]
        if not entries:
            return {}
            
        latest_entry = entries[-1]
        stats = self.get_statistics(test_name)
        
        return {
            'test_name': test_name,
            'total_runs': len(entries),
            'latest_run': latest_entry['timestamp'],
            'latest_metrics': latest_entry['metrics'],
            'statistics': stats
        }
        
    def import_baseline(self, import_file: str):
        """
        从文件导入基线数据
        Args:
            import_file: 导入文件路径
        """
        import_path = Path(import_file)
        if import_path.exists():
            with open(import_path, 'r', encoding='utf-8') as f:
                imported_data = json.load(f)
                
            # 合并数据
            for test_name, entries in imported_data.items():
                if test_name == 'alert_thresholds':
                    if test_name not in self.baseline_data:
                        self.baseline_data[test_name] = {}
                    self.baseline_data[test_name].update(entries)
                else:
                    if test_name not in self.baseline_data:
                        self.baseline_data[test_name] = []
                    self.baseline_data[test_name].extend(entries)
                    
            self._save_baseline()
            
    def export_baseline(self, export_file: str, test_name: str = None):
        """
        导出基线数据到文件
        Args:
            export_file: 导出文件路径
            test_name: 测试名称，如果为None则导出所有数据
        """
        export_path = Path(export_file)
        
        if test_name:
            if test_name in self.baseline_data:
                data = {test_name: self.baseline_data[test_name]}
            else:
                data = {}
        else:
            data = self.baseline_data.copy()
            
        with open(export_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
    def reset_baseline(self, test_name: str):
        """
        重置指定测试的基线数据
        Args:
            test_name: 测试名称
        """
        if test_name in self.baseline_data:
            self.baseline_data[test_name] = []
            self._save_baseline()
            
    def get_performance_ranking(self, metric_name: str) -> List[Dict[str, Any]]:
        """
        获取性能排名
        Args:
            metric_name: 指标名称
        Returns:
            性能排名列表
        """
        ranking = []
        
        for test_name in self.get_all_tests():
            stats = self.get_statistics(test_name)
            if metric_name in stats:
                ranking.append({
                    'test_name': test_name,
                    'value': stats[metric_name]['latest'],
                    'avg': stats[metric_name]['avg'],
                    'trend': stats[metric_name]['trend']
                })
                
        # 按最新值排序
        ranking.sort(key=lambda x: x['value'])
        
        return ranking
        
    def get_performance_insights(self, test_name: str) -> Dict[str, Any]:
        """
        获取性能洞察
        Args:
            test_name: 测试名称
        Returns:
            性能洞察信息