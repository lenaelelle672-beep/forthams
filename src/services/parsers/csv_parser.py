"""
CSV Parser Module for Asset Retirement System.

This module provides CSV file parsing capabilities for importing asset data
in support of the asset state transition workflow and retirement application
process.

Part of Phase 3: Workflow Engine & Approval Chain Implementation

Specifications:
- State transitions must be deterministic
- All state changes require immutable event records
- API compatibility with existing asset catalog data structures

Acceptance Criteria (AC):
- AC-001: Asset retirement workflow validation (unit test)
- AC-002: No new syntax errors introduced (AST static check)
- AC-003: All modified functions include docstring documentation
- AC-004: Module can be imported without ImportError
"""

import csv
import io
from typing import Any, BinaryIO, Dict, Iterator, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class CSVParseError(Exception):
    """Raised when CSV parsing fails due to format or content issues."""

    def __init__(self, message: str, row: Optional[int] = None, column: Optional[str] = None):
        self.message = message
        self.row = row
        self.column = column
        super().__init__(self._format_message())

    def _format_message(self) -> str:
        """Format error message with location context."""
        parts = [self.message]
        if self.row is not None:
            parts.append(f"at row {self.row}")
        if self.column is not None:
            parts.append(f"in column '{self.column}'")
        return " ".join(parts)


class ColumnMappingStrategy(Enum):
    """Strategy for mapping CSV columns to target schema."""
    BY_HEADER_NAME = "by_header_name"
    BY_POSITION = "by_position"
    BY_CONFIG = "by_config"


@dataclass
class CSVParseResult:
    """
    Container for CSV parsing results.

    Attributes:
        records: Parsed records as list of dictionaries
        errors: List of parsing errors encountered
        total_rows: Total number of rows processed
        successful_rows: Number of successfully parsed rows
        metadata: Additional parsing metadata
    """
    records: List[Dict[str, Any]] = field(default_factory=list)
    errors: List[CSVParseError] = field(default_factory=list)
    total_rows: int = 0
    successful_rows: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def failed_rows(self) -> int:
        """Return number of failed rows."""
        return self.total_rows - self.successful_rows

    @property
    def success_rate(self) -> float:
        """Calculate success rate as percentage."""
        if self.total_rows == 0:
            return 0.0
        return (self.successful_rows / self.total_rows) * 100


@dataclass
class ColumnMapping:
    """
    Defines mapping from CSV column to target field.

    Attributes:
        source_column: Original CSV column name
        target_field: Target schema field name
        transformer: Optional callable to transform value
        required: Whether field is required
        default: Default value if missing
    """
    source_column: str
    target_field: str
    transformer: Optional[callable] = None
    required: bool = False
    default: Any = None


class CSVParser:
    """
    CSV file parser with configurable column mapping.

    Supports parsing CSV data for asset retirement workflows, including
    state transition validation and event history imports.

    Example:
        >>> mapping = [
        ...     ColumnMapping("asset_id", "id", required=True),
        ...     ColumnMapping("status", "current_state"),
        ... ]
        >>> parser = CSVParser(column_mapping=mapping)
        >>> result = parser.parse_file("assets.csv")
    """

    DEFAULT_ENCODING = "utf-8"
    DEFAULT_DELIMITER = ","

    def __init__(
        self,
        column_mapping: Optional[List[ColumnMapping]] = None,
        encoding: str = DEFAULT_ENCODING,
        delimiter: str = DEFAULT_DELIMITER,
        skip_empty_rows: bool = True,
        strict_mode: bool = False
    ):
        """
        Initialize CSV parser with configuration.

        Args:
            column_mapping: List of column mapping definitions
            encoding: File encoding (default: utf-8)
            delimiter: CSV delimiter character (default: ,)
            skip_empty_rows: Skip rows with no data
            strict_mode: Raise exception on first error vs collect all
        """
        self.column_mapping = column_mapping or []
        self.encoding = encoding
        self.delimiter = delimiter
        self.skip_empty_rows = skip_empty_rows
        self.strict_mode = strict_mode

    def parse_file(self, file_path: str) -> CSVParseResult:
        """
        Parse CSV file at given path.

        Args:
            file_path: Path to CSV file

        Returns:
            CSVParseResult containing parsed records and errors
        """
        result = CSVParseResult()

        try:
            with open(file_path, "r", encoding=self.encoding) as f:
                return self.parse(f)
        except FileNotFoundError:
            raise CSVParseError(f"File not found: {file_path}")
        except IOError as e:
            raise CSVParseError(f"Failed to read file: {e}")

    def parse(self, source: BinaryIO | io.StringIO | str) -> CSVParseResult:
        """
        Parse CSV from file object, string, or bytes.

        Args:
            source: File object, CSV string, or bytes

        Returns:
            CSVParseResult containing parsed records and errors
        """
        result = CSVParseResult()
        content = self._read_content(source)

        try:
            reader = csv.DictReader(
                io.StringIO(content),
                delimiter=self.delimiter
            )

            result.metadata["headers"] = reader.fieldnames or []

            for row_num, row in enumerate(reader, start=2):  # Start at 2 (1 is header)
                if self._is_empty_row(row):
                    if self.skip_empty_rows:
                        continue

                parsed_record, error = self._parse_row(row, row_num)

                if error:
                    result.errors.append(error)
                    if self.strict_mode:
                        raise error
                else:
                    result.records.append(parsed_record)
                    result.successful_rows += 1

                result.total_rows += 1

        except csv.Error as e:
            raise CSVParseError(f"CSV format error: {e}")

        result.metadata["parse_time"] = datetime.now().isoformat()
        return result

    def parse_streaming(self, source: BinaryIO | io.StringIO) -> Iterator[Tuple[int, Dict[str, Any]]]:
        """
        Parse CSV in streaming mode for large files.

        Yields tuples of (row_number, parsed_record).

        Args:
            source: File object to parse

        Yields:
            Tuple of (row_number, parsed_record)
        """
        content = self._read_content(source)
        reader = csv.DictReader(io.StringIO(content), delimiter=self.delimiter)

        for row_num, row in enumerate(reader, start=2):
            if self._is_empty_row(row) and self.skip_empty_rows:
                continue

            parsed_record, error = self._parse_row(row, row_num)
            if error is None:
                yield (row_num, parsed_record)

    def _read_content(self, source: BinaryIO | io.StringIO | str) -> str:
        """Convert various input types to string content."""
        if isinstance(source, str):
            return source
        elif isinstance(source, io.StringIO):
            return source.getvalue()
        else:
            # Binary mode file
            content = source.read()
            if isinstance(content, bytes):
                return content.decode(self.encoding)
            return content

    def _is_empty_row(self, row: Dict[str, str]) -> bool:
        """Check if row contains no meaningful data."""
        return all(
            value.strip() == ""
            for value in row.values()
        )

    def _parse_row(self, row: Dict[str, str], row_num: int) -> Tuple[Dict[str, Any], Optional[CSVParseError]]:
        """
        Parse single row according to column mapping.

        Args:
            row: Raw row dictionary
            row_num: Row number for error reporting

        Returns:
            Tuple of (parsed_record, error_or_none)
        """
        parsed = {}

        for mapping in self.column_mapping:
            value = row.get(mapping.source_column, "").strip()

            if not value:
                if mapping.required:
                    return {}, CSVParseError(
                        f"Required field missing",
                        row=row_num,
                        column=mapping.source_column
                    )
                value = mapping.default

            try:
                if mapping.transformer:
                    parsed[mapping.target_field] = mapping.transformer(value)
                else:
                    parsed[mapping.target_field] = value
            except Exception as e:
                return {}, CSVParseError(
                    f"Transform failed: {e}",
                    row=row_num,
                    column=mapping.source_column
                )

        return parsed, None


def parse_retirement_csv(file_path: str) -> CSVParseResult:
    """
    Parse retirement application CSV file.

    This function provides a convenience wrapper for parsing
    retirement application files with standard column mapping.

    Args:
        file_path: Path to CSV file

    Returns:
        CSVParseResult with parsed retirement records

    Raises:
        CSVParseError: If file cannot be read or parsed

    Example CSV format:
        asset_id,reason,estimated_value,requester
        AST001,End of life,5000.00,john.doe
    """
    standard_mapping = [
        ColumnMapping("asset_id", "asset_id", required=True),
        ColumnMapping("reason", "reason"),
        ColumnMapping("estimated_value", "estimated_value", transformer=float),
        ColumnMapping("requester", "requester"),
        ColumnMapping("request_date", "request_date"),
        ColumnMapping("department", "department"),
    ]

    parser = CSVParser(column_mapping=standard_mapping)
    return parser.parse_file(file_path)


def validate_csv_structure(content: str, required_columns: List[str]) -> Tuple[bool, List[str]]:
    """
    Validate CSV structure has required columns.

    Args:
        content: CSV content as string
        required_columns: List of required column names

    Returns:
        Tuple of (is_valid, missing_columns)
    """
    reader = csv.DictReader(io.StringIO(content))
    headers = reader.fieldnames or []

    missing = [col for col in required_columns if col not in headers]
    return len(missing) == 0, missing


# Module exports for type checking and external use
__all__ = [
    "CSVParser",
    "CSVParseError",
    "CSVParseResult",
    "ColumnMapping",
    "ColumnMappingStrategy",
    "parse_retirement_csv",
    "validate_csv_structure",
]