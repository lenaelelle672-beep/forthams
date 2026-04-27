"""
Base parser module for asset management system.

This module provides the foundation for parsing various file formats
in the asset retirement and state transition workflow.

Architecture:
    - BaseParser: Abstract base class for all parsers
    - ParserResult: Container for parsing outcomes
    - ValidationError: Exception for parsing validation failures

Design Principles:
    - Deterministic parsing (same input yields same output)
    - Type-safe validation with clear error messages
    - Extensible plugin architecture for new formats

Usage:
    >>> from src.services.parsers.base import BaseParser, ParserResult
    >>> result = BaseParser.parse_file("assets.csv")
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional, List, Dict
from datetime import datetime
from enum import Enum
import hashlib
import json


class ParserError(Exception):
    """Base exception for parser-related errors."""
    
    def __init__(self, message: str, context: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.context = context or {}
        self.timestamp = datetime.utcnow()


class ValidationError(ParserError):
    """Raised when parser validation fails."""
    pass


class ParseError(ParserError):
    """Raised when parsing execution fails."""
    pass


class ParserStatus(Enum):
    """Parser execution status enumeration."""
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"


@dataclass
class ParserResult:
    """
    Container for parser execution results.
    
    Attributes:
        status: Current parser status
        data: Parsed data payload
        errors: List of parsing errors encountered
        metadata: Additional parsing metadata
        checksum: SHA256 hash for data integrity verification
    
    Example:
        >>> result = ParserResult(
        ...     status=ParserStatus.SUCCESS,
        ...     data={"assets": [...]},
        ...     metadata={"row_count": 100}
        ... )
    """
    status: ParserStatus
    data: Optional[Dict[str, Any]] = None
    errors: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    checksum: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def __post_init__(self):
        """Compute checksum after initialization for data integrity."""
        if self.data and not self.checksum:
            self.checksum = self._compute_checksum()
    
    def _compute_checksum(self) -> str:
        """Compute SHA256 checksum of the data payload."""
        serialized = json.dumps(self.data, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode()).hexdigest()
    
    def is_valid(self) -> bool:
        """Check if parsing result is valid and successful."""
        return self.status == ParserStatus.SUCCESS and not self.errors
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary representation."""
        return {
            "status": self.status.value,
            "data": self.data,
            "errors": self.errors,
            "metadata": self.metadata,
            "checksum": self.checksum,
            "timestamp": self.timestamp.isoformat()
        }


@dataclass
class ValidationContext:
    """
    Context object for parser validation operations.
    
    Attributes:
        asset_id: Target asset identifier
        user_id: User initiating the operation
        operation_type: Type of retirement operation
        metadata: Additional validation context
    """
    asset_id: Optional[str] = None
    user_id: Optional[str] = None
    operation_type: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


class BaseParser(ABC):
    """
    Abstract base class for all file format parsers.
    
    This class defines the contract for parser implementations
    used in asset state transition and retirement workflows.
    
    Parser Implementation Pattern:
        1. Validate input format and schema
        2. Parse content into structured data
        3. Compute integrity checksum
        4. Return ParserResult with status and data
    
    Example:
        >>> class CsvParser(BaseParser):
        ...     def parse(self, content: bytes) -> ParserResult:
        ...         # Implementation
        ...         return ParserResult(status=ParserStatus.SUCCESS, data={})
    """
    
    def __init__(self, strict_mode: bool = True):
        """
        Initialize base parser.
        
        Args:
            strict_mode: If True, raise exceptions on validation failures.
                        If False, collect errors and continue.
        """
        self.strict_mode = strict_mode
        self._validation_rules: List[Dict[str, Any]] = []
        self._parser_version = "1.0.0"
    
    @abstractmethod
    def parse(self, content: bytes) -> ParserResult:
        """
        Parse content and return structured result.
        
        Args:
            content: Raw byte content to parse
            
        Returns:
            ParserResult with parsed data and status
            
        Raises:
            ParseError: If parsing execution fails
            ValidationError: If validation constraints are not met (strict mode)
        """
        pass
    
    @abstractmethod
    def validate(self, content: bytes) -> bool:
        """
        Validate content before parsing.
        
        Args:
            content: Raw byte content to validate
            
        Returns:
            True if content is valid, False otherwise
        """
        pass
    
    def parse_file(self, file_path: str) -> ParserResult:
        """
        Parse file from disk path.
        
        Args:
            file_path: Path to file to parse
            
        Returns:
            ParserResult with parsed data
            
        Raises:
            FileNotFoundError: If file does not exist
            ParseError: If file cannot be read or parsed
        """
        with open(file_path, "rb") as f:
            content = f.read()
        return self.parse(content)
    
    def _add_validation_rule(self, field: str, rule_type: str, rule_config: Dict[str, Any]) -> None:
        """
        Add validation rule for parser.
        
        Args:
            field: Field name to validate
            rule_type: Type of validation (required, pattern, range)
            rule_config: Configuration for the validation rule
        """
        self._validation_rules.append({
            "field": field,
            "type": rule_type,
            "config": rule_config
        })
    
    def _apply_validation_rules(self, data: Dict[str, Any]) -> List[str]:
        """
        Apply registered validation rules to data.
        
        Args:
            data: Parsed data to validate
            
        Returns:
            List of validation error messages
        """
        errors = []
        for rule in self._validation_rules:
            field = rule["field"]
            rule_type = rule["type"]
            config = rule["config"]
            
            if rule_type == "required" and field not in data:
                errors.append(f"Required field '{field}' is missing")
            
            elif rule_type == "pattern" and field in data:
                import re
                pattern = config.get("pattern")
                if pattern and not re.match(pattern, str(data[field])):
                    errors.append(f"Field '{field}' does not match pattern '{pattern}'")
            
            elif rule_type == "range" and field in data:
                value = data[field]
                min_val = config.get("min")
                max_val = config.get("max")
                if (min_val is not None and value < min_val) or \
                   (max_val is not None and value > max_val):
                    errors.append(f"Field '{field}' value {value} out of range [{min_val}, {max_val}]")
        
        return errors
    
    def get_supported_formats(self) -> List[str]:
        """
        Get list of supported file formats.
        
        Returns:
            List of supported MIME types or file extensions
        """
        return []
    
    @property
    def version(self) -> str:
        """Get parser version string."""
        return self._parser_version