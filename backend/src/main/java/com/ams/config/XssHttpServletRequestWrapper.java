package com.ams.config;

import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

public class XssHttpServletRequestWrapper extends HttpServletRequestWrapper {

    private final byte[] cachedBody;

    public XssHttpServletRequestWrapper(HttpServletRequest request) {
        super(request);
        // 构造函数直接缓存 body，避免后续多次读取原始 request 流导致的 Stream closed
        this.cachedBody = cacheBody(request);
    }

    private static byte[] cacheBody(HttpServletRequest request) {
        try {
            return request.getInputStream().readAllBytes();
        } catch (IOException e) {
            // 没有 body 的请求（如 GET、DELETE）或流已关闭时，优雅处理
            return new byte[0];
        }
    }

    @Override
    public String getParameter(String name) {
        String value = super.getParameter(name);
        return sanitize(value);
    }

    @Override
    public String[] getParameterValues(String name) {
        String[] values = super.getParameterValues(name);
        if (values == null) return null;
        String[] sanitized = new String[values.length];
        for (int i = 0; i < values.length; i++) {
            sanitized[i] = sanitize(values[i]);
        }
        return sanitized;
    }

    @Override
    public String getHeader(String name) {
        String value = super.getHeader(name);
        return sanitize(value);
    }

    @Override
    public BufferedReader getReader() throws IOException {
        return new BufferedReader(new InputStreamReader(
                new ByteArrayInputStream(cachedBody), StandardCharsets.UTF_8));
    }

    @Override
    public ServletInputStream getInputStream() throws IOException {
        ByteArrayInputStream bais = new ByteArrayInputStream(cachedBody);
        return new ServletInputStream() {
            @Override
            public int read() { return bais.read(); }
            @Override
            public int read(byte[] b, int off, int len) { return bais.read(b, off, len); }
            @Override
            public boolean isFinished() { return bais.available() == 0; }
            @Override
            public boolean isReady() { return true; }
            @Override
            public void setReadListener(jakarta.servlet.ReadListener listener) {}
        };
    }

    private String sanitize(String value) {
        if (value == null || value.isEmpty()) return value;
        return value
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#x27;")
                .replaceAll("(?i)javascript\\s*:", "")
                .replaceAll("(?i)vbscript\\s*:", "")
                .replaceAll("(?i)onload\\s*=", "data-removed=")
                .replaceAll("(?i)onerror\\s*=", "data-removed=")
                .replaceAll("(?i)onclick\\s*=", "data-removed=");
    }
}
