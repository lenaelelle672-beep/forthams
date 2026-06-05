-- V3_40__insurance_management_additions.sql
-- Phase 4: T4.3 保险管理补充 — 通知模板 + insurance_claim 表字段补充
-- 幂等设计（IF EXISTS / ALTER TABLE ADD COLUMN IF NOT EXISTS），可重复执行

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. insurance_claim 表字段补充（incident_description, settled_amount, settle_date, remark）
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE insurance_claim
    ADD COLUMN IF NOT EXISTS incident_description TEXT COMMENT '事故描述' AFTER claim_date,
    ADD COLUMN IF NOT EXISTS settled_amount DECIMAL(12,2) DEFAULT 0.00 COMMENT '已赔付金额' AFTER claim_amount,
    ADD COLUMN IF NOT EXISTS settle_date DATE COMMENT '赔付日期' AFTER status,
    ADD COLUMN IF NOT EXISTS remark TEXT COMMENT '备注' AFTER settle_date;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. insurance 表字段补充（remark）
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE insurance
    ADD COLUMN IF NOT EXISTS remark TEXT COMMENT '备注' AFTER status;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. 通知模板 INSURANCE_EXPIRING 种子数据
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO notification_template (template_code, template_name, template_content, variables, tenant_id, create_by, create_time, update_time, deleted)
VALUES (
    'INSURANCE_EXPIRING',
    '保险到期提醒',
    '您管理的保险保单【{policyNo}】({insuranceName}) 即将到期，到期日期：{endDate}，剩余天数：{daysRemaining} 天。请及时续保以避免保障中断。',
    'policyNo,insuranceName,insurer,endDate,daysRemaining',
    'default',
    1,
    NOW(),
    NOW(),
    0
)
ON DUPLICATE KEY UPDATE
    template_content = VALUES(template_content),
    variables = VALUES(variables),
    update_time = NOW();