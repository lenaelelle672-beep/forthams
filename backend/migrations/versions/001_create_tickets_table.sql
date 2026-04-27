-- ============================================================================
-- SWARM-001: 工单审批流程系统 - Phase 1 迁移脚本
-- 版本: 001
-- 描述: 创建工单(tickets)核心表及关联表
-- 作者: System
-- 创建时间: 2024
-- ============================================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. 创建枚举类型: 工单状态
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE ticket_status AS ENUM (
        'DRAFT',           -- 草稿态（初始状态）
        'SUBMITTED',       -- 已提交（等待审批）
        'APPROVED',        -- 已批准
        'REJECTED',        -- 已拒绝
        'RETIRED',         -- 已退役
        'DISPOSED'         -- 已处置
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. 创建枚举类型: 审批动作
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE approval_action AS ENUM (
        'SUBMIT',          -- 提交
        'APPROVE',         -- 批准
        'REJECT',          -- 拒绝
        'RESUBMIT',        -- 重新提交
        'RETIRE',          -- 退役
        'DISPOSE'          -- 处置
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 3. 创建枚举类型: 事件类型
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE ticket_event_type AS ENUM (
        'TICKET_CREATED',
        'TICKET_SUBMITTED',
        'TICKET_APPROVED',
        'TICKET_REJECTED',
        'TICKET_RETIRED',
        'TICKET_DISPOSED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 4. 创建用户表(基础版本，用于 Phase 1 FK 引用)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(200),
    department VARCHAR(200),
    role VARCHAR(50) DEFAULT 'USER',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================================================
-- 5. 创建工单主表
-- ============================================================================
CREATE TABLE IF NOT EXISTS tickets (
    -- 主键
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- 核心业务字段
    title VARCHAR(255) NOT NULL,                          -- 工单标题
    description TEXT,                                      -- 工单描述
    ticket_type VARCHAR(50) NOT NULL DEFAULT 'GENERAL',   -- 工单类型 (GENERAL, PURCHASE, EXPENSE, PROJECT)
    
    -- 状态字段
    status ticket_status NOT NULL DEFAULT 'DRAFT',
    
    -- 优先级
    priority VARCHAR(20) DEFAULT 'NORMAL',                -- LOW, NORMAL, HIGH, URGENT
    
    -- 人员关联
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    current_approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- 分类字段
    category VARCHAR(100),                                 -- 工单分类
    tags TEXT[],                                           -- 标签数组
    
    -- 业务数据（JSON 格式存储工单特定数据）
    business_data JSONB DEFAULT '{}',
    
    -- 版本控制（用于乐观锁）
    version INTEGER NOT NULL DEFAULT 1,
    
    -- 时间戳
    submitted_at TIMESTAMP WITH TIME ZONE,                 -- 提交时间
    approved_at TIMESTAMP WITH TIME ZONE,                  -- 批准时间
    rejected_at TIMESTAMP WITH TIME ZONE,                  -- 拒绝时间
    
    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    
    -- 软删除
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(100)
);

-- 工单表索引
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_creator_id ON tickets(creator_id);
CREATE INDEX IF NOT EXISTS idx_tickets_current_approver_id ON tickets(current_approver_id);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type ON tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_deleted_at ON tickets(deleted_at) WHERE deleted_at IS NOT NULL;

-- 复合索引: 待审批工单查询
CREATE INDEX IF NOT EXISTS idx_tickets_pending_approval ON tickets(status, current_approver_id) 
    WHERE status = 'SUBMITTED';

-- ============================================================================
-- 6. 创建审批记录表
-- ============================================================================
CREATE TABLE IF NOT EXISTS approval_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- 关联工单
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    
    -- 审批人信息
    approver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approver_name VARCHAR(200),
    
    -- 审批信息
    action approval_action NOT NULL,
    status VARCHAR(20) NOT NULL,                           -- PENDING, COMPLETED, SKIPPED
    decision VARCHAR(20),                                  -- APPROVED, REJECTED
    
    -- 审批意见
    comments TEXT,
    rejection_reason TEXT,
    
    -- 审批时间
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMP WITH TIME ZONE,
    
    -- 审批顺序
    step_order INTEGER NOT NULL DEFAULT 1,
    
    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- 审批记录表索引
CREATE INDEX IF NOT EXISTS idx_approval_records_ticket_id ON approval_records(ticket_id);
CREATE INDEX IF NOT EXISTS idx_approval_records_approver_id ON approval_records(approver_id);
CREATE INDEX IF NOT EXISTS idx_approval_records_action ON approval_records(action);
CREATE INDEX IF NOT EXISTS idx_approval_records_status ON approval_records(status);

-- ============================================================================
-- 7. 创建工单事件表（为 Phase 3 实时通知预留）
-- ============================================================================
CREATE TABLE IF NOT EXISTS ticket_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- 关联工单
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    
    -- 事件类型
    event_type ticket_event_type NOT NULL,
    
    -- 事件负载
    payload JSONB NOT NULL DEFAULT '{}',
    
    -- 状态变更详情
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    
    -- 触发者
    triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    triggered_by_username VARCHAR(100),
    
    -- 事件时间
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- 传播状态（用于 WebSocket/SSE）
    published BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE
);

-- 事件表索引
CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket_id ON ticket_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_events_event_type ON ticket_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ticket_events_published ON ticket_events(published) WHERE published = false;
CREATE INDEX IF NOT EXISTS idx_ticket_events_occurred_at ON ticket_events(occurred_at);

-- ============================================================================
-- 8. 创建状态转换规则表（可选，用于动态配置）
-- ============================================================================
CREATE TABLE IF NOT EXISTS state_transition_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- 规则名称
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- 转换条件
    from_status ticket_status NOT NULL,
    to_status ticket_status NOT NULL,
    allowed_action VARCHAR(50) NOT NULL,
    
    -- 权限要求
    required_role VARCHAR(50),
    
    -- 条件表达式（JSON 格式）
    conditions JSONB DEFAULT '{}',
    
    -- 审计字段
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- 状态转换规则表索引
CREATE INDEX IF NOT EXISTS idx_state_transition_rules_from ON state_transition_rules(from_status);
CREATE INDEX IF NOT EXISTS idx_state_transition_rules_to ON state_transition_rules(to_status);
CREATE INDEX IF NOT EXISTS idx_state_transition_rules_active ON state_transition_rules(is_active) WHERE is_active = true;

-- ============================================================================
-- 9. 创建触发器: 自动更新 updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 tickets 表创建触发器
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 users 表创建触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 state_transition_rules 表创建触发器
DROP TRIGGER IF EXISTS update_state_transition_rules_updated_at ON state_transition_rules;
CREATE TRIGGER update_state_transition_rules_updated_at
    BEFORE UPDATE ON state_transition_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 10. 插入初始数据: 状态转换规则
-- ============================================================================
INSERT INTO state_transition_rules (name, description, from_status, to_status, allowed_action, required_role, is_active)
VALUES 
    ('提交工单', '将草稿态工单提交进行审批', 'DRAFT', 'SUBMITTED', 'SUBMIT', 'USER', true),
    ('批准工单', '审批人批准已提交的工单', 'SUBMITTED', 'APPROVED', 'APPROVE', 'APPROVER', true),
    ('拒绝工单', '审批人拒绝工单', 'SUBMITTED', 'REJECTED', 'REJECT', 'APPROVER', true),
    ('重新提交', '被拒绝的工单重新提交', 'REJECTED', 'SUBMITTED', 'RESUBMIT', 'USER', true),
    ('执行退役', '将已批准的工单执行退役', 'APPROVED', 'RETIRED', 'RETIRE', 'ADMIN', true),
    ('执行处置', '将已退役的工单执行处置', 'RETIRED', 'DISPOSED', 'DISPOSE', 'ADMIN', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 11. 创建注释
-- ============================================================================
COMMENT ON TABLE tickets IS '工单主表 - 存储所有工单的核心信息';
COMMENT ON COLUMN tickets.status IS '工单状态: DRAFT(草稿), SUBMITTED(已提交), APPROVED(已批准), REJECTED(已拒绝), RETIRED(已退役), DISPOSED(已处置)';
COMMENT ON COLUMN tickets.version IS '乐观锁版本号，用于并发控制';
COMMENT ON COLUMN tickets.business_data IS '工单业务数据 JSON，用于存储工单特定的自定义字段';
COMMENT ON COLUMN tickets.deleted_at IS '软删除时间戳，为 NULL 表示未删除';

COMMENT ON TABLE approval_records IS '审批记录表 - 记录每个工单的审批历史';
COMMENT ON COLUMN approval_records.action IS '审批动作: SUBMIT, APPROVE, REJECT, RESUBMIT, RETIRE, DISPOSE';
COMMENT ON COLUMN approval_records.decision IS '审批决定: APPROVED(批准), REJECTED(拒绝)';

COMMENT ON TABLE ticket_events IS '工单事件表 - 用于 Phase 3 实时通知的事件发布';
COMMENT ON COLUMN ticket_events.published IS '事件是否已通过 WebSocket/SSE 推送';

COMMENT ON TABLE state_transition_rules IS '状态转换规则表 - 定义工单状态机转换规则';
COMMENT ON COLUMN state_transition_rules.conditions IS '转换条件表达式 JSON，支持复杂业务规则配置';

-- ============================================================================
-- 迁移完成标记
-- ============================================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Migration 001_create_tickets_table completed successfully';
END $$;