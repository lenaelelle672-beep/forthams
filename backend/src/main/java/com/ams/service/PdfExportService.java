package com.ams.service;

import com.lowagie.text.pdf.BaseFont;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.xhtmlrenderer.pdf.ITextRenderer;
import lombok.RequiredArgsConstructor;

import java.io.ByteArrayOutputStream;
import java.util.Map;

/**
 * PDF 报表导出服务 — 基于 Thymeleaf HTML 模板渲染 + FlyingSaucer 转 PDF
 * 支持中文字体（使用系统预装字体或 resources/templates/fonts/ 下的字体文件）
 */
@Service
@RequiredArgsConstructor
public class PdfExportService {

    private final TemplateEngine templateEngine;

    /**
     * 导出 PDF 报表
     *
     * @param templateName Thymeleaf 模板名称（不含后缀，位于 templates/pdf/ 目录下）
     * @param data         模板变量
     * @return PDF 字节数组
     */
    public byte[] exportReport(String templateName, Map<String, Object> data) {
        try {
            // 渲染 HTML
            Context context = new Context();
            context.setVariables(data);
            String html = templateEngine.process("pdf/" + templateName, context);

            // HTML 转 PDF
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ITextRenderer renderer = new ITextRenderer();

            // 设置中文字体（按优先级查找）
            String fontPath = findChineseFont();
            if (fontPath != null) {
                renderer.getFontResolver().addFont(fontPath, true);
            }

            renderer.setDocumentFromString(html, "/");
            renderer.layout();
            renderer.createPDF(baos);
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("PDF export failed: " + e.getMessage(), e);
        }
    }

    /**
     * 查找系统中可用的中文字体
     */
    private String findChineseFont() {
        String[] fontPaths = {
            "/System/Library/Fonts/PingFang.ttc",
            "/System/Library/Fonts/STHeiti Light.ttc",
            "/usr/share/fonts/truetype/wqy/wqy-microhei.ttf",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "classpath:/templates/fonts/NotoSansCJK-Regular.ttc",
        };
        for (String path : fontPaths) {
            try {
                java.io.File fontFile = new java.io.File(path);
                if (fontFile.exists()) return path;
            } catch (Exception e) {
                // continue
            }
        }
        return null;
    }
}
