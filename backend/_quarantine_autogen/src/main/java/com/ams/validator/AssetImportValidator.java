package com.ams.validator;

import com.ams.entity.Asset;
import com.ams.service.AssetService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Validator for asset batch import/export operations (SWARM-502).
 * Handles validation of uploaded Excel files and CSV export formatting.
 */
@Component
public class AssetImportValidator {

    private static final long MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
    private static final int MAX_ROWS = 5000;
    private static final Set<String> REQUIRED_FIELDS = Set.of("name", "type", "status", "value", "location", "category");

    @Autowired
    private AssetService assetService;

    /**
     * Validates an uploaded Excel file for asset import.
     * Checks file type (.xlsx), size (<=10MB), row count (<=5000), required columns, and duplicate business keys.
     *
     * @param file the uploaded MultipartFile
     * @return a ValidationResult containing errors (if any) and parsed rows
     * @throws IOException if file reading fails
     */
    public ValidationResult validateExcelUpload(MultipartFile file) throws IOException {
        ValidationResult result = new ValidationResult();

        // File type check
        if (!file.getOriginalFilename().toLowerCase().endsWith(".xlsx")) {
            result.addError("file", "File must be in .xlsx format");
            return result;
        }

        // Size check
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            result.addError("file", "File size must not exceed 10 MB");
            return result;
        }

        // Parse and validate content
        try (Reader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            List<Map<String, String>> rows = parseExcelLikeCsv(reader); // simplified parsing for validator scope
            result.setRowCount(rows.size());

            // Row count check
            if (rows.size() > MAX_ROWS) {
                result.addError("file", "File contains more than " + MAX_ROWS + " rows");
                return result;
            }

            // Column and required field checks
            if (!rows.isEmpty()) {
                Map<String, String> firstRow = rows.get(0);
                for (String required : REQUIRED_FIELDS) {
                    if (!firstRow.containsKey(required)) {
                        result.addError("columns", "Missing required column: " + required);
                    }
                }
            }

            // Per-row validation and duplicate detection
            Map<String, Integer> businessKeyCount = new HashMap<>();
            for (int i = 0; i < rows.size(); i++) {
                Map<String, String> row = rows.get(i);
                int finalI = i + 2; // 1-based header row + 1

                for (String field : REQUIRED_FIELDS) {
                    String value = row.get(field);
                    if (value == null || value.trim().isEmpty()) {
                        result.addError("row " + finalI + ", field " + field, "Required field is empty");
                    }
                }

                // Business key deduplication detection (using name+type as example key)
                String bk = row.get("name") + "|" + row.get("type");
                businessKeyCount.put(bk, businessKeyCount.getOrDefault(bk, 0) + 1);
            }

            for (Map.Entry<String, Integer> e : businessKeyCount.entrySet()) {
                if (e.getValue() > 1) {
                    result.addError("duplicate", "Duplicate business key detected: " + e.getKey());
                }
            }
        }

        return result;
    }

    /**
     * Exports assets to CSV format (UTF-8) with headers.
     *
     * @return CSV content as a String
     */
    public String exportAssetsToCsv() {
        List<Asset> assets = assetService.findAll();
        StringBuilder csv = new StringBuilder();
        csv.append("id,name,type,status,value,location,category,created_at\n");
        for (Asset a : assets) {
            csv.append(String.join(",",
                escapeCsvField(a.getId().toString()),
                escapeCsvField(a.getName()),
                escapeCsvField(a.getType()),
                escapeCsvField(a.getStatus()),
                escapeCsvField(a.getValue().toString()),
                escapeCsvField(a.getLocation()),
                escapeCsvField(a.getCategory()),
                escapeCsvField(a.getCreatedAt().toString())
            )).append("\n");
        }
        return csv.toString();
    }

    private String escapeCsvField(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    // Simplified parser for validator scope; real implementation would use Apache POI for .xlsx
    private List<Map<String, String>> parseExcelLikeCsv(Reader reader) throws IOException {
        List<Map<String, String>> rows = new ArrayList<>();
        try (BufferedReader br = new BufferedReader(reader)) {
            String line;
            String[] headers = null;
            int lineNo = 0;
            while ((line = br.readLine()) != null) {
                lineNo++;
                String[] values = line.split(",", -1);
                if (lineNo == 1) {
                    headers = values;
                } else if (headers != null && values.length == headers.length) {
                    Map<String, String> row = new LinkedHashMap<>();
                    for (int i = 0; i < headers.length; i++) {
                        row.put(headers[i].trim(), values[i].trim());
                    }
                    rows.add(row);
                }
            }
        }
        return rows;
    }

    /**
     * Result container for validation outcomes.
     */
    public static class ValidationResult {
        private final List<String> errors = new ArrayList<>();
        private int rowCount;

        public void addError(String field, String message) {
            errors.add(field + ": " + message);
        }

        public List<String> getErrors() {
            return errors;
        }

        public boolean hasErrors() {
            return !errors.isEmpty();
        }

        public int getRowCount() {
            return rowCount;
        }

        public void setRowCount(int rowCount) {
            this.rowCount = rowCount;
        }
    }
}