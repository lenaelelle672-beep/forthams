#!/usr/bin/env python3
"""
Dead Code Visitor for AST Analysis
Integrates with Graphify knowledge图谱 system for technical debt identification
"""

import ast
import csv
import inspect
import os
import sys
from typing import Dict, List, Optional, Set, Tuple, Union

# Add project root to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from graphify import Node, Edge, KnowledgeGraph


class DeadCodeVisitor(ast.NodeVisitor):
    """
    AST Visitor for detecting dead code patterns in Python source code.
    Integrates with Graphify knowledge图谱 system for technical debt tracking.
    """

    def __init__(self, filename: str, community_id: int = 1):
        """
        Initialize the DeadCodeVisitor.
        
        Args:
            filename: Path to the Python file being analyzed
            community_id: Community identifier for Graphify integration
        """
        self.filename = filename
        self.community_id = community_id
        self.dead_code_candidates = []
        self.visited_nodes = set()
        self.function_nodes = {}
        self.class_nodes = {}
        self.import_nodes = {}
        self.audit_service = AuditServiceStub()
        
        # Initialize knowledge graph
        self.graph = KnowledgeGraph()
        
        # Statistics
        self.stats = {
            'total_functions': 0,
            'dead_functions': 0,
            'total_classes': 0,
            'dead_classes': 0,
            'total_imports': 0,
            'unused_imports': 0,
            'total_lines': 0,
            'dead_lines': 0
        }

    def _get_node_id_for_name(self, name: str, node_type: str) -> str:
        """
        Generate a unique node ID for a given name and type.
        
        Args:
            name: Name of the node
            node_type: Type of node ('function', 'class', 'import')
            
        Returns:
            Unique node identifier
        """
        return f"{node_type}_{name}_{self.community_id}"

    def _record_node(self, node: Node) -> None:
        """
        Record a node in the knowledge graph.
        
        Args:
            node: Node to be recorded
        """
        self.graph.add_node(node)
        self.audit_service._record_node(node)

    def _record_edge(self, edge: Edge) -> None:
        """
        Record an edge in the knowledge graph.
        
        Args:
            edge: Edge to be recorded
        """
        self.graph.add_edge(edge)
        self.audit_service._record_edge(edge)

    def _get_method_docstring(self, node: ast.FunctionDef) -> Optional[str]:
        """
        Extract docstring from a function or method node.
        
        Args:
            node: AST function definition node
            
        Returns:
            Docstring text or None if not found
        """
        if (node.body and 
            isinstance(node.body[0], ast.Expr) and 
            isinstance(node.body[0].value, ast.Str)):
            return node.body[0].value.s
        return None

    def _analyze_dead_code(self) -> None:
        """
        Analyze dead code patterns in the visited AST nodes.
        This is the core analysis logic that should not be modified.
        """
        # Analyze functions
        for func_name, func_node in self.function_nodes.items():
            self.stats['total_functions'] += 1
            if self._is_dead_code_candidate(func_node):
                self.dead_code_candidates.append(('function', func_name, func_node.lineno))
                self.stats['dead_functions'] += 1

        # Analyze classes
        for class_name, class_node in self.class_nodes.items():
            self.stats['total_classes'] += 1
            if self._is_dead_code_candidate(class_node):
                self.dead_code_candidates.append(('class', class_name, class_node.lineno))
                self.stats['dead_classes'] += 1

        # Analyze imports
        for import_name, import_node in self.import_nodes.items():
            self.stats['total_imports'] += 1
            if self._is_dead_code_candidate(import_node):
                self.dead_code_candidates.append(('import', import_name, import_node.lineno))
                self.stats['unused_imports'] += 1

    def _is_dead_code_candidate(self, node: Union[ast.FunctionDef, ast.ClassDef, ast.Import]) -> bool:
        """
        Check if a node is a candidate for dead code.
        This is the core identification logic that should not be modified.
        
        Args:
            node: AST node to check
            
        Returns:
            True if the node is a dead code candidate
        """
        node_id = self._get_node_id_for_name(node.name, type(node).__name__.lower())
        
        if node_id in self.visited_nodes:
            return False

        if isinstance(node, ast.FunctionDef):
            return self._is_empty_function(node)
        elif isinstance(node, ast.ClassDef):
            return self._is_empty_class(node)
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            return node.name not in self.visited_nodes
        return False

    def _is_empty_function(self, node: ast.FunctionDef) -> bool:
        """
        Check if a function is empty (dead code candidate).
        
        Args:
            node: AST function definition node
            
        Returns:
            True if the function is empty
        """
        # Check if function has no body or only contains pass
        if not node.body:
            return True
        
        # Check for pass statement or docstring only
        for stmt in node.body:
            if not isinstance(stmt, (ast.Pass, ast.Expr, ast.Str)):
                return False
        return True

    def _is_empty_class(self, node: ast.ClassDef) -> bool:
        """
        Check if a class is empty (dead code candidate).
        
        Args:
            node: AST class definition node
            
        Returns:
            True if the class is empty
        """
        # Check if class has no body or only contains pass
        if not node.body:
            return True
        
        # Check for pass statement or docstring only
        for stmt in node.body:
            if not isinstance(stmt, (ast.Pass, ast.Expr, ast.Str)):
                return False
        return True

    def visit_Module(self, node: ast.Module) -> None:
        """
        Visit module node and initialize analysis.
        
        Args:
            node: AST module node
        """
        self.stats['total_lines'] = len(node.body)
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        """
        Visit function definition node.
        
        Args:
            node: AST function definition node
        """
        func_id = self._get_node_id_for_name(node.name, 'function')
        
        # Create function node
        func_node = Node(
            id=func_id,
            type='function',
            name=node.name,
            line=node.lineno,
            column=node.col_offset,
            filename=self.filename,
            community_id=self.community_id,
            docstring=self._get_method_docstring(node)
        )
        
        self._record_node(func_node)
        self.function_nodes[node.name] = node
        self.visited_nodes.add(func_id)
        
        # Record edges from class to function if method
        if hasattr(node, 'parent_class'):
            class_id = self._get_node_id_for_name(node.parent_class, 'class')
            edge = Edge(
                source=class_id,
                target=func_id,
                type='contains',
                filename=self.filename,
                community_id=self.community_id
            )
            self._record_edge(edge)
        
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        """
        Visit class definition node.
        
        Args:
            node: AST class definition node
        """
        class_id = self._get_node_id_for_name(node.name, 'class')
        
        # Create class node
        class_node = Node(
            id=class_id,
            type='class',
            name=node.name,
            line=node.lineno,
            column=node.col_offset,
            filename=self.filename,
            community_id=self.community_id,
            docstring=self._get_method_docstring(node)
        )
        
        self._record_node(class_node)
        self.class_nodes[node.name] = node
        self.visited_nodes.add(class_id)
        
        # Record inheritance edges
        for base in node.bases:
            if isinstance(base, ast.Name):
                base_id = self._get_node_id_for_name(base.id, 'class')
                edge = Edge(
                    source=base_id,
                    target=class_id,
                    type='inherits',
                    filename=self.filename,
                    community_id=self.community_id
                )
                self._record_edge(edge)
        
        # Mark methods with parent class
        for child in node.body:
            if isinstance(child, ast.FunctionDef):
                child.parent_class = node.name
        
        self.generic_visit(node)

    def visit_Import(self, node: ast.Import) -> None:
        """
        Visit import node.
        
        Args:
            node: AST import node
        """
        for alias in node.names:
            import_id = self._get_node_id_for_name(alias.name, 'import')
            
            # Create import node
            import_node = Node(
                id=import_id,
                type='import',
                name=alias.name,
                line=node.lineno,
                column=node.col_offset,
                filename=self.filename,
                community_id=self.community_id
            )
            
            self._record_node(import_node)
            self.import_nodes[alias.name] = node
            self.visited_nodes.add(import_id)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        """
        Visit from-import node.
        
        Args:
            node: AST import-from node
        """
        for alias in node.names:
            import_name = f"{node.module}.{alias.name}" if node.module else alias.name
            import_id = self._get_node_id_for_name(import_name, 'import')
            
            # Create import node
            import_node = Node(
                id=import_id,
                type='import',
                name=import_name,
                line=node.lineno,
                column=node.col_offset,
                filename=self.filename,
                community_id=self.community_id
            )
            
            self._record_node(import_node)
            self.import_nodes[import_name] = node
            self.visited_nodes.add(import_id)

    def visit_Name(self, node: ast.Name) -> None:
        """
        Visit name node to track usage.
        
        Args:
            node: AST name node
        """
        if isinstance(node.ctx, ast.Load):
            # Track usage of imported names
            for import_name in self.import_nodes:
                if node.id == import_name:
                    self.visited_nodes.add(self._get_node_id_for_name(import_name, 'import'))
        self.generic_visit(node)

    def get_dead_code(self) -> List[Tuple[str, str, int]]:
        """
        Get list of dead code candidates.
        
        Returns:
            List of tuples (type, name, line_number)
        """
        self._analyze_dead_code()
        return self.dead_code_candidates

    def get_all_nodes(self) -> List[Node]:
        """
        Get all nodes in the knowledge graph.
        
        Returns:
            List of all nodes
        """
        return self.graph.get_all_nodes()

    def get_edges(self) -> List[Edge]:
        """
        Get all edges in the knowledge graph.
        
        Returns:
            List of all edges
        """
        return self.graph.get_edges()

    def get_graph_data(self) -> Dict:
        """
        Get complete graph data structure.
        
        Returns:
            Dictionary containing nodes and edges
        """
        return self.graph.get_data()

    def get_statistics(self) -> Dict:
        """
        Get analysis statistics.
        
        Returns:
            Dictionary of statistics
        """
        return self.stats


class AuditServiceStub:
    """
    Stub implementation of AuditService for testing purposes.
    """

    def __init__(self):
        """Initialize audit service stub."""
        self.audit_log = []
        self.nodes = []
        self.edges = []

    def _record_node(self, node: Node) -> None:
        """
        Record a node for audit purposes.
        
        Args:
            node: Node to record
        """
        self.nodes.append(node)
        self.audit_log.append({
            'type': 'node',
            'id': node.id,
            'timestamp': '2024-01-01T00:00:00Z'
        })

    def _record_edge(self, edge: Edge) -> None:
        """
        Record an edge for audit purposes.
        
        Args:
            edge: Edge to record
        """
        self.edges.append(edge)
        self.audit_log.append({
            'type': 'edge',
            'source': edge.source,
            'target': edge.target,
            'timestamp': '2024-01-01T00:00:00Z'
        })

    def log_audit_event(self, event: Dict) -> None:
        """
        Log an audit event.
        
        Args:
            event: Event dictionary to log
        """
        self.audit_log.append(event)


class AuditServiceIntegration:
    """
    Integration implementation of AuditService.
    """

    def __init__(self):
        """Initialize audit service integration."""
        self.audit_log = []
        self.nodes = []
        self.edges = []

    def _record_node(self, node: Node) -> None:
        """
        Record a node for audit purposes.
        
        Args:
            node: Node to record
        """
        self.nodes.append(node)
        self.audit_log.append({
            'type': 'node',
            'id': node.id,
            'timestamp': '2024-01-01T00:00:00Z'
        })

    def _record_edge(self, edge: Edge) -> None:
        """
        Record an edge for audit purposes.
        
        Args:
            edge: Edge to record
        """
        self.edges.append(edge)
        self.audit_log.append({
            'type': 'edge',
            'source': edge.source,
            'target': edge.target,
            'timestamp': '2024-01-01T00:00:00Z'
        })

    def log_audit_event(self, event: Dict) -> None:
        """
        Log an audit event.
        
        Args:
            event: Event dictionary to log
        """
        self.audit_log.append(event)


def analyze_with_ast(filename: str, community_id: int = 1) -> DeadCodeVisitor:
    """
    Analyze a Python file using AST.
    
    Args:
        filename: Path to the Python file
        community_id: Community identifier
        
    Returns:
        DeadCodeVisitor instance with analysis results
    """
    with open(filename, 'r', encoding='utf-8') as f:
        source = f.read()
    
    tree = ast.parse(source, filename)
    visitor = DeadCodeVisitor(filename, community_id)
    visitor.visit(tree)
    
    return visitor


def format_output_csv(visitor: DeadCodeVisitor, output_file: str) -> None:
    """
    Format analysis results as CSV.
    
    Args:
        visitor: DeadCodeVisitor instance
        output_file: Output CSV file path
    """
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['Type', 'Name', 'Line Number', 'Community ID', 'Filename'])
        
        for dead_type, name, line in visitor.get_dead_code():
            writer.writerow([
                dead_type,
                name,
                line,
                visitor.community_id,
                visitor.filename
            ])


def parse_csv_output(csv_file: str) -> List[Dict]:
    """
    Parse CSV output back to dictionary format.
    
    Args:
        csv_file: Path to CSV file
        
    Returns:
        List of dead code entries
    """
    results = []
    with open(csv_file, 'r', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            results.append(dict(row))
    return results


def get_daemon() -> DeadCodeVisitor:
    """
    Get daemon instance for continuous monitoring.
    
    Returns:
        DeadCodeVisitor instance
    """
    return DeadCodeVisitor("daemon.py", community_id=1)


def index_node_for_search(node: Node) -> Dict:
    """
    Index a node for search functionality.
    
    Args:
        node: Node to index
        
    Returns:
        Search index dictionary
    """
    return {
        'id': node.id,
        'type': node.type,
        'name': node.name,
        'line': node.line,
        'filename': node.filename,
        'community_id': node.community_id
    }


# Main execution
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ast_dead_code_check.py <filename> [community_id]")
        sys.exit(1)
    
    filename = sys.argv[1]
    community_id = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    
    visitor = analyze_with_ast(filename, community_id)
    
    print(f"Analysis complete for {filename}")
    print(f"Dead code found: {len(visitor.get_dead_code())} items")
    print(f"Statistics: {visitor.get_statistics()}")
    
    # Output to CSV
    csv_file = f"{filename}_dead_code.csv"
    format_output_csv(visitor, csv_file)
    print(f"Results saved to {csv_file}")