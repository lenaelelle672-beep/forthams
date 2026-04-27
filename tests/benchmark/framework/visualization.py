@@ create visualization module for benchmark framework
"""
Performance visualization module for DeadCodeVisitor benchmark framework.
Provides chart generation and performance data visualization.
"""

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import json
from pathlib import Path


@dataclass
class PerformanceMetrics:
    """Container for performance metrics data."""
    test_name: str
    code_size: int
    execution_time: float
    memory_usage: float
    cpu_usage: float
    timestamp: str


class PerformanceVisualizer:
    """Handles visualization of benchmark performance data."""
    
    def __init__(self, output_dir: str = "benchmark_reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
    def generate_performance_chart(self, 
                                 metrics_list: List[PerformanceMetrics],
                                 chart_type: str = "line") -> str:
        """Generate performance charts from metrics data."""
        if not metrics_list:
            raise ValueError("No metrics data provided for visualization")
            
        df = pd.DataFrame([{
            'test_name': m.test_name,
            'code_size': m.code_size,
            'execution_time': m.execution_time,
            'memory_usage': m.memory_usage,
            'cpu_usage': m.cpu_usage,
            'timestamp': m.timestamp
        } for m in metrics_list])
        
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        fig.suptitle('DeadCodeVisitor Performance Analysis', fontsize=16)
        
        # Execution Time vs Code Size
        axes[0, 0].scatter(df['code_size'], df['execution_time'], alpha=0.6)
        axes[0, 0].set_xlabel('Code Size (lines)')
        axes[0, 0].set_ylabel('Execution Time (seconds)')
        axes[0, 0].set_title('Execution Time vs Code Size')
        axes[0, 0].grid(True, alpha=0.3)
        
        # Memory Usage vs Code Size
        axes[0, 1].scatter(df['code_size'], df['memory_usage'], alpha=0.6, color='orange')
        axes[0, 1].set_xlabel('Code Size (lines)')
        axes[0, 1].set_ylabel('Memory Usage (MB)')
        axes[0, 1].set_title('Memory Usage vs Code Size')
        axes[0, 1].grid(True, alpha=0.3)
        
        # CPU Usage vs Code Size
        axes[1, 0].scatter(df['code_size'], df['cpu_usage'], alpha=0.6, color='green')
        axes[1, 0].set_xlabel('Code Size (lines)')
        axes[1, 0].set_ylabel('CPU Usage (%)')
        axes[1, 0].set_title('CPU Usage vs Code Size')
        axes[1, 0].grid(True, alpha=0.3)
        
        # Performance Trend Over Time
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        axes[1, 1].plot(df['timestamp'], df['execution_time'], marker='o', alpha=0.6)
        axes[1, 1].set_xlabel('Timestamp')
        axes[1, 1].set_ylabel('Execution Time (seconds)')
        axes[1, 1].set_title('Performance Trend Over Time')
        axes[1, 1].grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        
        plt.tight_layout()
        
        # Save chart
        chart_path = self.output_dir / f"performance_chart_{chart_type}.png"
        plt.savefig(chart_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        return str(chart_path)
    
    def generate_regression_analysis(self, 
                                   baseline_metrics: List[PerformanceMetrics],
                                   current_metrics: List[PerformanceMetrics]) -> Dict[str, Any]:
        """Generate regression analysis comparing current vs baseline performance."""
        baseline_df = pd.DataFrame([{
            'execution_time': m.execution_time,
            'memory_usage': m.memory_usage,
            'cpu_usage': m.cpu_usage
        } for m in baseline_metrics])
        
        current_df = pd.DataFrame([{
            'execution_time': m.execution_time,
            'memory_usage': m.memory_usage,
            'cpu_usage': m.cpu_usage
        } for m in current_metrics])
        
        analysis = {
            'time_regression': {
                'baseline_mean': baseline_df['execution_time'].mean(),
                'current_mean': current_df['execution_time'].mean(),
                'change_percent': ((current_df['execution_time'].mean() - 
                                  baseline_df['execution_time'].mean()) / 
                                 baseline_df['execution_time'].mean()) * 100
            },
            'memory_regression': {
                'baseline_mean': baseline_df['memory_usage'].mean(),
                'current_mean': current_df['memory_usage'].mean(),
                'change_percent': ((current_df['memory_usage'].mean() - 
                                  baseline_df['memory_usage'].mean()) / 
                                 baseline_df['memory_usage'].mean()) * 100
            },
            'cpu_regression': {
                'baseline_mean': baseline_df['cpu_usage'].mean(),
                'current_mean': current_df['cpu_usage'].mean(),
                'change_percent': ((current_df['cpu_usage'].mean() - 
                                  baseline_df['cpu_usage'].mean()) / 
                                 baseline_df['cpu_usage'].mean()) * 100
            }
        }
        
        # Save analysis
        analysis_path = self.output_dir / "regression_analysis.json"
        with open(analysis_path, 'w') as f:
            json.dump(analysis, f, indent=2)
        
        return analysis
    
    def generate_performance_report(self, 
                                  metrics_list: List[PerformanceMetrics],
                                  regression_analysis: Optional[Dict[str, Any]] = None) -> str:
        """Generate comprehensive performance report."""
        report_path = self.output_dir / "performance_report.html"
        
        # Calculate summary statistics
        df = pd.DataFrame([{
            'execution_time': m.execution_time,
            'memory_usage': m.memory_usage,
            'cpu_usage': m.cpu_usage,
            'code_size': m.code_size
        } for m in metrics_list])
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>DeadCodeVisitor Performance Report</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ background-color: #f0f0f0; padding: 20px; border-radius: 5px; }}
                .metrics {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }}
                .metric-card {{ background-color: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }}
                .chart {{ margin: 20px 0; }}
                table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f2f2f2; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>DeadCodeVisitor Performance Report</h1>
                <p>Generated on: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
            
            <div class="metrics">
                <div class="metric-card">
                    <h3>Execution Time</h3>
                    <p>Average: {df['execution_time'].mean():.2f}s</p>
                    <p>Max: {df['execution_time'].max():.2f}s</p>
                    <p>Min: {df['execution_time'].min():.2f}s</p>
                </div>
                <div class="metric-card">
                    <h3>Memory Usage</h3>
                    <p>Average: {df['memory_usage'].mean():.2f}MB</p>
                    <p>Max: {df['memory_usage'].max():.2f}MB</p>
                    <p>Min: {df['memory_usage'].min():.2f}MB</p>
                </div>
                <div class="metric-card">
                    <h3>CPU Usage</h3>
                    <p>Average: {df['cpu_usage'].mean():.2f}%</p>
                    <p>Max: {df['cpu_usage'].max():.2f}%</p>
                    <p>Min: {df['cpu_usage'].min():.2f}%</p>
                </div>
                <div class="metric-card">
                    <h3>Code Size Range</h3>
                    <p>Min: {df['code_size'].min()} lines</p>
                    <p>Max: {df['code_size'].max()} lines</p>
                    <p>Average: {df['code_size'].mean():.0f} lines</p>
                </div>
            </div>
        """
        
        if regression_analysis:
            html_content += f"""
            <div class="regression">
                <h2>Regression Analysis</h2>
                <table>
                    <tr><th>Metric</th><th>Baseline</th><th>Current</th><th>Change %</th></tr>
                    <tr>
                        <td>Execution Time</td>
                        <td>{regression_analysis['time_regression']['baseline_mean']:.2f}s</td>
                        <td>{regression_analysis['time_regression']['current_mean']:.2f}s</td>
                        <td>{regression_analysis['time_regression']['change_percent']:+.2f}%</td>
                    </tr>
                    <tr>
                        <td>Memory Usage</td>
                        <td>{regression_analysis['memory_regression']['baseline_mean']:.2f}MB</td>
                        <td>{regression_analysis['memory_regression']['current_mean']:.2f}MB</td>
                        <td>{regression_analysis['memory_regression']['change_percent']:+.2f}%</td>
                    </tr>
                    <tr>
                        <td>CPU Usage</td>
                        <td>{regression_analysis['cpu_regression']['baseline_mean']:.2f}%</td>
                        <td>{regression_analysis['cpu_regression']['current_mean']:.2f}%</td>
                        <td>{regression_analysis['cpu_regression']['change_percent']:+.2f}%</td>
                    </tr>
                </table>
            </div>
            """
        
        html_content += """
        </body>
        </html>
        """
        
        with open(report_path, 'w') as f:
            f.write(html_content)
        
        return str(report_path)
    
    def export_metrics_to_csv(self, metrics_list: List[PerformanceMetrics]) -> str:
        """Export metrics data to CSV format."""
        csv_path = self.output_dir / "performance_metrics.csv"
        
        df = pd.DataFrame([{
            'test_name': m.test_name,
            'code_size': m.code_size,
            'execution_time': m.execution_time,
            'memory_usage': m.memory_usage,
            'cpu_usage': m.cpu_usage,
            'timestamp': m.timestamp
        } for m in metrics_list])
        
        df.to_csv(csv_path, index=False)
        return str(csv_path)


def create_performance_visualizer(output_dir: str = "benchmark_reports") -> PerformanceVisualizer:
    """Factory function to create performance visualizer instance."""
    return PerformanceVisualizer(output_dir)