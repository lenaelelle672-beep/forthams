@@ benchmark framework initialization
 """
 DeadCodeVisitor Performance Benchmark Framework
 
 This module provides a comprehensive benchmarking framework for evaluating
 DeadCodeVisitor performance across different codebase scales.
 
 Features:
 - Multi-scale test scenarios (small, medium, large, extra-large)
 - Resource consumption monitoring (CPU, memory, disk I/O)
 - Response time measurement
 - Performance regression detection
 - Automated test execution and result collection
 - Visualization and reporting capabilities
 """
 
 import os
 import sys
 import time
 import json
 import logging
 import tempfile
 import shutil
 from typing import Dict, List, Any, Optional, Tuple
 from dataclasses import dataclass, field
 from pathlib import Path
 from concurrent.futures import ThreadPoolExecutor, as_completed
 import psutil
 import matplotlib.pyplot as plt
 import numpy as np
 
 # Configure logging
 logging.basicConfig(
     level=logging.INFO,
     format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
 )
 logger = logging.getLogger(__name__)
 
 
 @dataclass
 class BenchmarkConfig:
     """Configuration for benchmark execution"""
     test_scales: List[str] = field(default_factory=lambda: ['small', 'medium', 'large', 'extra-large'])
     iterations_per_scale: int = 3
     timeout_seconds: int = 300
     memory_limit_mb: int = 2048
     cpu_limit_percent: int = 80
     output_dir: str = "benchmark_results"
     enable_profiling: bool = True
     enable_memory_profiling: bool = True
     enable_disk_profiling: bool = True
 
 
 @dataclass
 class BenchmarkResult:
     """Result of a single benchmark run"""
     scale: str
     iteration: int
     execution_time: float
     peak_memory_mb: float
     avg_cpu_percent: float
     dead_code_count: int
     total_nodes: int
     total_edges: int
     disk_io_read_mb: float
     disk_io_write_mb: float
     timestamp: float
     error: Optional[str] = None
 
 
 class ResourceMonitor:
     """Monitor system resources during benchmark execution"""
     
     def __init__(self, process: psutil.Process):
         self.process = process
         self.start_time = time.time()
         self.start_memory = process.memory_info().rss / 1024 / 1024  # MB
         self.cpu_samples = []
         self.disk_io_read = 0
         self.disk_io_write = 0
         self.disk_io_start = process.io_counters()
     
     def update(self):
         """Update resource monitoring data"""
         try:
             # CPU monitoring
             cpu_percent = self.process.cpu_percent()
             self.cpu_samples.append(cpu_percent)
             
             # Memory monitoring
             current_memory = self.process.memory_info().rss / 1024 / 1024  # MB
             
             # Disk I/O monitoring
             if self.process.io_counters():
                 current_io = self.process.io_counters()
                 self.disk_io_read += (current_io.read_bytes - self.disk_io_start.read_bytes) / 1024 / 1024  # MB
                 self.disk_io_write += (current_io.write_bytes - self.disk_io_start.write_bytes) / 1024 / 1024  # MB
                 self.disk_io_start = current_io
             
             return {
                 'memory_mb': current_memory,
                 'cpu_percent': cpu_percent,
                 'disk_read_mb': self.disk_io_read,
                 'disk_write_mb': self.disk_io_write
             }
         except Exception as e:
             logger.warning(f"Resource monitoring error: {e}")
             return None
     
     def get_summary(self):
         """Get summary statistics"""
         return {
             'peak_memory_mb': max([self.start_memory] + [s.get('memory_mb', 0) for s in self._get_samples()]),
             'avg_cpu_percent': np.mean(self.cpu_samples) if self.cpu_samples else 0,
             'total_disk_read_mb': self.disk_io_read,
             'total_disk_write_mb': self.disk_io_write,
             'duration_seconds': time.time() - self.start_time
         }
     
     def _get_samples(self):
         """Get all monitoring samples"""
         samples = []
         for i in range(len(self.cpu_samples)):
             samples.append({
                 'memory_mb': self.start_memory + (i * 0.1),  # Approximate
                 'cpu_percent': self.cpu_samples[i],
                 'disk_read_mb': self.disk_io_read * (i / len(self.cpu_samples)),
                 'disk_write_mb': self.disk_io_write * (i / len(self.cpu_samples))
             })
         return samples
 
 
 class BenchmarkRunner:
     """Main benchmark execution class"""
     
     def __init__(self, config: BenchmarkConfig):
         self.config = config
         self.results: List[BenchmarkResult] = []
         self.test_data_generator = None
         self.setup_output_directory()
     
     def setup_output_directory(self):
         """Setup output directory for results"""
         os.makedirs(self.config.output_dir, exist_ok=True)
         os.makedirs(os.path.join(self.config.output_dir, "raw_data"), exist_ok=True)
         os.makedirs(os.path.join(self.config.output_dir, "reports"), exist_ok=True)
         os.makedirs(os.path.join(self.config.output_dir, "visualizations"), exist_ok=True)
     
     def load_test_data_generator(self):
         """Load test data generator"""
         try:
             from scripts.benchmark.test_data import TestDataGenerator
             self.test_data_generator = TestDataGenerator()
         except ImportError as e:
             logger.error(f"Failed to load test data generator: {e}")
             raise
     
     def run_benchmark(self):
         """Execute complete benchmark suite"""
         logger.info("Starting DeadCodeVisitor benchmark suite")
         
         # Load test data generator
         self.load_test_data_generator()
         
         # Run benchmark for each scale
         for scale in self.config.test_scales:
             logger.info(f"Running benchmark for scale: {scale}")
             self.run_scale_benchmark(scale)
         
         # Generate reports and visualizations
         self.generate_reports()
         self.generate_visualizations()
         
         logger.info("Benchmark suite completed")
         return self.results
     
     def run_scale_benchmark(self, scale: str):
         """Run benchmark for a specific scale"""
         # Generate test data for this scale
         test_data_path = self.test_data_generator.generate_test_data(scale)
         
         # Run multiple iterations
         for iteration in range(self.config.iterations_per_scale):
             logger.info(f"Running iteration {iteration + 1} for scale {scale}")
             result = self.run_single_iteration(scale, iteration, test_data_path)
             self.results.append(result)
             
             # Clean up test data
             if os.path.exists(test_data_path):
                 shutil.rmtree(test_data_path)
     
     def run_single_iteration(self, scale: str, iteration: int, test_data_path: str) -> BenchmarkResult:
         """Run a single benchmark iteration"""
         start_time = time.time()
         result = BenchmarkResult(
             scale=scale,
             iteration=iteration,
             execution_time=0,
             peak_memory_mb=0,
             avg_cpu_percent=0,
             dead_code_count=0,
             total_nodes=0,
             total_edges=0,
             disk_io_read_mb=0,
             disk_io_write_mb=0,
             timestamp=start_time
         )
         
         try:
             # Start resource monitoring
             process = psutil.Process()
             monitor = ResourceMonitor(process)
             
             # Execute DeadCodeVisitor analysis
             from scripts.ast_dead_code_check import analyze_with_ast
             
             # Run analysis with timeout
             import signal
             
             def timeout_handler(signum, frame):
                 raise TimeoutError(f"Analysis timed out after {self.config.timeout_seconds} seconds")
             
             signal.signal(signal.SIGALRM, timeout_handler)
             signal.alarm(self.config.timeout_seconds)
             
             try:
                 # Run analysis
                 analysis_result = analyze_with_ast(test_data_path)
                 
                 # Collect results
                 result.dead_code_count = len(analysis_result.get('dead_code', []))
                 result.total_nodes = len(analysis_result.get('nodes', []))
                 result.total_edges = len(analysis_result.get('edges', []))
                 
             finally:
                 signal.alarm(0)  # Cancel alarm
             
             # Get final resource usage
             resource_summary = monitor.get_summary()
             result.execution_time = time.time() - start_time
             result.peak_memory_mb = resource_summary['peak_memory_mb']
             result.avg_cpu_percent = resource_summary['avg_cpu_percent']
             result.disk_io_read_mb = resource_summary['total_disk_read_mb']
             result.disk_io_write_mb = resource_summary['total_disk_write_mb']
             
             logger.info(f"Iteration {iteration + 1} completed: "
                        f"Time={result.execution_time:.2f}s, "
                        f"Memory={result.peak_memory_mb:.2f}MB, "
                        f"DeadCode={result.dead_code_count}")
             
         except Exception as e:
             result.error = str(e)
             logger.error(f"Iteration {iteration + 1} failed: {e}")
         
         # Save raw result data
         self.save_raw_result(result)
         
         return result
     
     def save_raw_result(self, result: BenchmarkResult):
         """Save raw result data"""
         result_file = os.path.join(
             self.config.output_dir, 
             "raw_data", 
             f"{result.scale}_iteration_{result.iteration}.json"
         )
         
         with open(result_file, 'w') as f:
             json.dump({
                 'scale': result.scale,
                 'iteration': result.iteration,
                 'execution_time': result.execution_time,
                 'peak_memory_mb': result.peak_memory_mb,
                 'avg_cpu_percent': result.avg_cpu_percent,
                 'dead_code_count': result.dead_code_count,
                 'total_nodes': result.total_nodes,
                 'total_edges': result.total_edges,
                 'disk_io_read_mb': result.disk_io_read_mb,
                 'disk_io_write_mb': result.disk_io_write_mb,
                 'timestamp': result.timestamp,
                 'error': result.error
             }, f, indent=2)
     
     def generate_reports(self):
         """Generate benchmark reports"""
         logger.info("Generating benchmark reports")
         
         # Aggregate results by scale
         scale_results = {}
         for result in self.results:
             if result.scale not in scale_results:
                 scale_results[result.scale] = []
             scale_results[result.scale].append(result)
         
         # Generate summary report
         summary_report = {
             'benchmark_config': {
                 'test_scales': self.config.test_scales,
                 'iterations_per_scale': self.config.iterations_per_scale,
                 'timeout_seconds': self.config.timeout_seconds,
                 'memory_limit_mb': self.config.memory_limit_mb,
                 'cpu_limit_percent': self.config.cpu_limit_percent,
                 'output_dir': self.config.output_dir,
                 'enable_profiling': self.config.enable_profiling,
                 'enable_memory_profiling': self.config.enable_memory_profiling,
                 'enable_disk_profiling': self.config.enable_disk_profiling
             },
             'timestamp': time.time(),
             'total_iterations': len(self.results),
             'scale_summaries': {}
         }
         
         # Calculate statistics for each scale
         for scale, results in scale_results.items():
             successful_results = [r for r in results if r.error is None]
             
             if successful_results:
                 execution_times = [r.execution_time for r in successful_results]
                 memory_usage = [r.peak_memory_mb for r in successful_results]
                 cpu_usage = [r.avg_cpu_percent for r in successful_results]
                 dead_code_counts = [r.dead_code_count for r in successful_results]
                 node_counts = [r.total_nodes for r in successful_results]
                 edge_counts = [r.total_edges for r in successful_results]
                 disk_read = [r.disk_io_read_mb for r in successful_results]
                 disk_write = [r.disk_io_write_mb for r in successful_results]
                 
                 summary_report['scale_summaries'][scale] = {
                     'iterations': len(successful_results),
                     'success_rate': len(successful_results) / len(results) * 100,
                     'execution_time': {
                         'mean': np.mean(execution_times),
                         'median': np.median(execution_times),
                         'std': np.std(execution_times),
                         'min': np.min(execution_times),
                         'max': np.max(execution_times)
                     },
                     'memory_usage': {
                         'mean': np.mean(memory_usage),
                         'median': np.median(memory_usage),
                         'std': np.std(memory_usage),
                         'min': np.min(memory_usage),
                         'max': np.max(memory_usage)
                     },
                     'cpu_usage': {
                         'mean': np.mean(cpu_usage),
                         'median': np.median(cpu_usage),
                         'std': np.std(cpu_usage),
                         'min': np.min(cpu_usage),
                         'max': np.max(cpu_usage)
                     },
                     'dead_code_count': {
                         'mean': np.mean(dead_code_counts),
                         'median': np.median(dead_code_counts),
                         'std': np.std(dead_code_counts),
                         'min': np.min(dead_code_counts),
                         'max': np.max(dead_code_counts)
                     },
                     'node_count': {
                         'mean': np.mean(node_counts),
                         'median': np.median(node_counts),
                         'std': np.std(node_counts),
                         'min': np.min(node_counts),
                         'max': np.max(node_counts)
                     },
                     'edge_count': {
                         'mean': np.mean(edge_counts),
                         'median': np.median(edge_counts),
                         'std': np.std(edge_counts),
                         'min': np.min(edge_counts),
                         'max': np.max(edge_counts)
                     },
                     'disk_io': {
                         'read_mb': {
                             'mean': np.mean(disk_read),
                             'median': np.median(disk_read),
                             'std': np.std(disk_read),
                             'min': np.min(disk_read),
                             'max': np.max(disk_read)
                         },
                         'write_mb': {
                             'mean': np.mean(disk_write),
                             'median': np.median(disk_write),
                             'std': np.std(disk_write),
                             'min': np.min(disk_write),
                             'max': np.max(disk_write)
                         }
                     }
                 }
             else:
                 summary_report['scale_summaries'][scale] = {
                     'iterations': 0,
                     'success_rate': 0,
                     'error': 'All iterations failed'
                 }
         
         # Save summary report
         report_file = os.path.join(self.config.output_dir, "reports", "benchmark_summary.json")
         with open(report_file, 'w') as f:
             json.dump(summary_report, f, indent=2)
         
         logger.info(f"Summary report saved to: {report_file}")
     
     def generate_visualizations(self):
         """Generate benchmark visualizations"""
         logger.info("Generating benchmark visualizations")
         
         # Prepare data for visualization
         scales = []
         execution_times = []
         memory_usage = []
         dead_code_counts = []
         
         for result in self.results:
             if result.error is None:
                 scales.append(result.scale)
                 execution_times.append(result.execution_time)
                 memory_usage.append(result.peak_memory_mb)
                 dead_code_counts.append(result.dead_code_count)
         
         if not scales:
             logger.warning("No successful results to visualize")
             return
         
         # Create performance comparison chart
         fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
         
         # Execution time by scale
         ax1.bar(scales, execution_times, color='skyblue')
         ax1.set_title('Execution Time by Scale')
         ax1.set_xlabel('Scale')
         ax1.set_ylabel('Time (seconds)')
         ax1.grid(True, alpha=0.3)
         
         # Memory usage by scale
         ax2.bar(scales, memory_usage, color='lightgreen')
         ax2.set_title('Memory Usage by Scale')
         ax2.set_xlabel('Scale')
         ax2.set_ylabel('Memory (MB)')
         ax2.grid(True, alpha=0.3)
         
         # Dead code count by scale
         ax3.bar(scales, dead_code_counts, color='salmon')
         ax3.set_title('Dead Code Count by Scale')
         ax3.set_xlabel('Scale')
         ax3.set_ylabel('Count')
         ax3.grid(True, alpha=0.3)
         
         # Correlation: Execution time vs Memory usage
         ax4.scatter(memory_usage, execution_times, alpha=0.7, color='purple')
         ax4.set_title('Execution Time vs Memory Usage')
         ax4.set_xlabel('Memory Usage (MB)')
         ax4.set_ylabel('Execution Time (seconds)')
         ax4.grid(True, alpha=0.3)
         
         plt.tight_layout()
         
         # Save visualization
         viz_file = os.path.join(self.config.output_dir, "visualizations", "benchmark_performance.png")
         plt.savefig(viz_file, dpi=300, bbox_inches='tight')
         plt.close()
         
         logger.info(f"Performance visualization saved to: {viz_file}")
         
         # Create trend analysis chart
         self.create_trend_analysis()
     
     def create_trend_analysis