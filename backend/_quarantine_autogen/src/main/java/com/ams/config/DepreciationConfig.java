package com.ams.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 折旧配置类 (隔离区文件 - 禁止修改)
 * 
 * ⚠️ 根据 SPEC-CONTEXT-SYNC-2026-04-22-AC-003 约束:
 * [禁止 B-004] 禁止修改隔离区文件（除非当前任务明确要求）
 * 
 * 状态: 已隔离到 backend/_quarantine_autogen/
 * 用途: 保留审查，后续 Java 后端开发时按需选择性恢复
 * 
 * 此文件内容受保护，不应通过 jhipster regenerate 或其他自动生成工具覆盖。
 * 如需修改，请先人工审查代码内容，评估业务价值后按恢复流程操作。
 */
@Configuration
@EnableScheduling
public class DepreciationConfig {
    
    /**
     * 折旧计算调度 cron 表达式
     * 默认: 每天凌晨 2:00 执行
     */
    private static final String DEFAULT_CRON = "0 0 2 * * ?";
    
    /**
     * 是否启用自动折旧计算
     */
    private boolean autoCalculateEnabled = true;
    
    /**
     * 折旧计算批次大小
     */
    private int batchSize = 100;
    
    /**
     * 默认折旧方法
     */
    private String defaultMethod = "STRAIGHT_LINE";
}