package com.ams.controller;

import com.ams.common.Result;
import com.ams.service.BarcodeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/barcodes")
@RequiredArgsConstructor
public class BarcodeController {

    private final BarcodeService barcodeService;

    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping(value = "/asset/{assetId}", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> getAssetQrCode(@PathVariable Long assetId) {
        byte[] qrCode = barcodeService.generateQrCode(assetId);
        return ResponseEntity.ok()
                .header("Content-Disposition", "inline; filename=\"asset-" + assetId + ".png\"")
                .body(qrCode);
    }

    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping("/asset/{assetId}/label")
    public Result<Map<String, Object>> getAssetLabel(@PathVariable Long assetId) {
        return Result.success(barcodeService.generateLabel(assetId));
    }

    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping(value = "/asset/{assetId}/label-image", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> getAssetLabelImage(@PathVariable Long assetId) {
        byte[] labelImage = barcodeService.generateLabelImage(assetId);
        return ResponseEntity.ok()
                .header("Content-Disposition", "inline; filename=\"label-" + assetId + ".png\"")
                .body(labelImage);
    }

    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @PostMapping("/batch")
    public Result<List<Map<String, Object>>> batchGenerateLabels(@RequestBody Map<String, List<Long>> request) {
        List<Long> assetIds = request.get("assetIds");
        return Result.success(barcodeService.batchGenerateLabels(assetIds));
    }
}
