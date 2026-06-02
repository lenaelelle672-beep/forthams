package com.ams.service;

import com.ams.entity.Asset;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.qrcode.QRCodeWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.*;

@Service
@RequiredArgsConstructor
public class BarcodeService {

    private final AssetService assetService;
    private final ObjectMapper objectMapper;

    private static final int QR_SIZE = 300;
    private static final int LABEL_WIDTH = 400;
    private static final int LABEL_HEIGHT = 300;

    public byte[] generateQrCode(Long assetId) {
        Asset asset = assetService.getAssetById(assetId);
        return generateQrCodeBytes(buildQrContent(asset));
    }

    public String generateQrCodeBase64(Long assetId) {
        byte[] png = generateQrCode(assetId);
        return Base64.getEncoder().encodeToString(png);
    }

    public Map<String, Object> generateLabel(Long assetId) {
        Asset asset = assetService.getAssetById(assetId);
        String qrBase64 = generateQrCodeBase64(assetId);

        Map<String, Object> label = new LinkedHashMap<>();
        label.put("qrBase64", qrBase64);
        label.put("assetInfo", Map.of(
                "id", asset.getId(),
                "assetNo", asset.getAssetNo(),
                "assetName", asset.getAssetName(),
                "model", asset.getModel() != null ? asset.getModel() : "",
                "brand", asset.getBrand() != null ? asset.getBrand() : "",
                "status", asset.getStatus() != null ? asset.getStatus() : ""
        ));
        return label;
    }

    public byte[] generateLabelImage(Long assetId) {
        Asset asset = assetService.getAssetById(assetId);
        byte[] qrPng = generateQrCodeBytes(buildQrContent(asset));

        try {
            BufferedImage qrImg = ImageIO.read(new java.io.ByteArrayInputStream(qrPng));
            BufferedImage label = new BufferedImage(LABEL_WIDTH, LABEL_HEIGHT, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = label.createGraphics();

            g.setColor(Color.WHITE);
            g.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);

            g.drawImage(qrImg, 20, 20, 120, 120, null);

            g.setColor(Color.BLACK);
            g.setFont(new Font("SansSerif", Font.BOLD, 14));
            g.drawString(asset.getAssetName() != null ? asset.getAssetName() : "", 160, 45);

            g.setFont(new Font("SansSerif", Font.PLAIN, 12));
            g.drawString("编号: " + (asset.getAssetNo() != null ? asset.getAssetNo() : ""), 160, 70);
            g.drawString("品牌: " + (asset.getBrand() != null ? asset.getBrand() : ""), 160, 90);
            g.drawString("型号: " + (asset.getModel() != null ? asset.getModel() : ""), 160, 110);
            g.drawString("状态: " + (asset.getStatus() != null ? asset.getStatus() : ""), 160, 130);

            g.dispose();

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(label, "PNG", baos);
            return baos.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate label image", e);
        }
    }

    public java.util.List<Map<String, Object>> batchGenerateLabels(java.util.List<Long> assetIds) {
        return assetIds.stream().map(this::generateLabel).toList();
    }

    private String buildQrContent(Asset asset) {
        try {
            Map<String, Object> content = new LinkedHashMap<>();
            content.put("id", asset.getId());
            content.put("no", asset.getAssetNo());
            content.put("name", asset.getAssetName());
            return objectMapper.writeValueAsString(content);
        } catch (Exception e) {
            throw new RuntimeException("Failed to build QR content", e);
        }
    }

    private byte[] generateQrCodeBytes(String content) {
        QRCodeWriter writer = new QRCodeWriter();
        try {
            var bitMatrix = writer.encode(content, BarcodeFormat.QR_CODE, QR_SIZE, QR_SIZE);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(bitMatrix, "PNG", baos);
            return baos.toByteArray();
        } catch (WriterException | IOException e) {
            throw new RuntimeException("Failed to generate QR code", e);
        }
    }
}
