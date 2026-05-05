package com.assetmanage.parser;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;

/**
 * Abstract base class for file parsers used in asset batch import operations.
 * <p>
 * Provides a common contract for parsing spreadsheet files into structured
 * row data, with built-in row-limit enforcement (max 5000 data rows) and
 * file-extension detection. Concrete implementations handle format-specific
 * parsing logic (e.g., SAX-based XLSX parsing, CSV line-by-line reading).
 * </p>
 *
 * <p>Usage: Obtain an instance via {@link FileParserFactory} based on the
 * uploaded file's extension, then call {@link #parse(InputStream)} to retrieve
 * row-level data for downstream validation and persistence.</p>
 *
 * @see FileParserFactory
 * @see ExcelFileParser
 * @see CsvFileParser
 */
public abstract class FileParser {

    /**
     * Maximum number of data rows allowed per import file (excluding header row).
     * Aligned with SPEC: single upload hard limit of 5000 rows.
     */
    public static final int MAX_ROWS = 5000;

    /**
     * Parses the given input stream into a list of row maps.
     * <p>
     * The first row is treated as column headers; subsequent rows are returned
     * as {@code Map<String, String>} where keys are header names and values are
     * raw cell string representations.
     * </p>
     *
     * <p>Implementations MUST enforce {@link #MAX_ROWS} and throw
     * {@link IOException} or a subclass thereof if the row count exceeds the limit.</p>
     *
     * @param inputStream the input stream of the file to parse; must not be null.
     *                    The caller is responsible for closing this stream.
     * @return an ordered list of maps, one per data row (excluding the header row).
     *         Each map is keyed by the corresponding header column name.
     *         Returns an empty list if the file contains only a header row.
     * @throws IOException if an I/O error occurs during reading, the file is
     *                     malformed, or the row count exceeds {@link #MAX_ROWS}
     */
    public abstract List<Map<String, String>> parse(InputStream inputStream) throws IOException;

    /**
     * Returns the file extension this parser handles (including the leading dot).
     * <p>
     * Example return values: {@code ".xlsx"}, {@code ".csv"}.
     * Used by {@link #supports(String)} for format detection.
     * </p>
     *
     * @return the supported file extension, never null
     */
    public abstract String getSupportedExtension();

    /**
     * Checks whether this parser supports the given file based on its name/extension.
     * <p>
     * The check is case-insensitive. A {@code null} or blank file name
     * will always return {@code false}.
     * </p>
     *
     * @param fileName the original uploaded file name to check; may be null
     * @return {@code true} if the file extension matches {@link #getSupportedExtension()}
     */
    public boolean supports(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return false;
        }
        return fileName.trim().toLowerCase().endsWith(getSupportedExtension().toLowerCase());
    }

    /**
     * Returns the maximum number of data rows this parser will process.
     * <p>
     * Subclasses may override to provide a different limit, but the default
     * enforces the SPEC-defined cap of {@value #MAX_ROWS} rows.
     * </p>
     *
     * @return the maximum data row count (excluding header)
     */
    public int getMaxRows() {
        return MAX_ROWS;
    }
}