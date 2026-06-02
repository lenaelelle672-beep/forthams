package com.ams.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Profile("!test")
@RequiredArgsConstructor
public class AuditSchemaInitializer implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        ensureRbacSchema();
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS general_audit_entry (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    trace_id VARCHAR(64),
                    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    action VARCHAR(512),
                    before_record LONGTEXT,
                    after_record LONGTEXT,
                    operation_type VARCHAR(64),
                    operator_id VARCHAR(64),
                    operator_name VARCHAR(128),
                    resource_type VARCHAR(64),
                    resource_id VARCHAR(128),
                    detail TEXT,
                    ip_address VARCHAR(64),
                    INDEX idx_general_audit_timestamp (timestamp),
                    INDEX idx_general_audit_operation_type (operation_type),
                    INDEX idx_general_audit_operator (operator_id),
                    INDEX idx_general_audit_resource (resource_type, resource_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS sys_operate_log (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    module VARCHAR(128),
                    operation VARCHAR(128),
                    business_type VARCHAR(64),
                    method VARCHAR(256),
                    request_method VARCHAR(16),
                    request_uri VARCHAR(512),
                    operator_id BIGINT,
                    operator_name VARCHAR(128),
                    operator_ip VARCHAR(64),
                    request_params LONGTEXT,
                    response_data LONGTEXT,
                    status TINYINT DEFAULT 0,
                    error_message TEXT,
                    cost_time BIGINT,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_operate_log_time (create_time),
                    INDEX idx_operate_log_operator (operator_id),
                    INDEX idx_operate_log_business (business_type),
                    INDEX idx_operate_log_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS sys_post (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    post_code VARCHAR(64) NOT NULL,
                    post_name VARCHAR(128) NOT NULL,
                    sort_order INT DEFAULT 0,
                    status TINYINT DEFAULT 1,
                    remark VARCHAR(512),
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0,
                    UNIQUE KEY uk_post_code (post_code),
                    INDEX idx_status_deleted (status, deleted)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS sys_user_post (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    user_id BIGINT NOT NULL,
                    post_id BIGINT NOT NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_user_post (user_id, post_id),
                    INDEX idx_user_id (user_id),
                    INDEX idx_post_id (post_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
    }

    private void ensureRbacSchema() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS sys_menu (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    menu_name VARCHAR(128) NOT NULL,
                    parent_id BIGINT DEFAULT 0,
                    sort_order INT DEFAULT 0,
                    path VARCHAR(256),
                    component VARCHAR(256),
                    query_param VARCHAR(256),
                    route_name VARCHAR(128),
                    menu_type CHAR(1) NOT NULL DEFAULT 'M',
                    visible TINYINT DEFAULT 1,
                    status TINYINT DEFAULT 1,
                    perms VARCHAR(128),
                    icon VARCHAR(128),
                    is_frame TINYINT DEFAULT 1,
                    is_cache TINYINT DEFAULT 1,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted TINYINT DEFAULT 0,
                    INDEX idx_menu_perms (perms),
                    INDEX idx_parent_sort (parent_id, sort_order),
                    INDEX idx_menu_type (menu_type),
                    INDEX idx_status_deleted (status, deleted)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        dropIndexIfExists("sys_menu", "uk_menu_perms");
        addIndexIfMissing("sys_menu", "idx_menu_perms", "perms");

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS sys_role_menu (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    role_id BIGINT NOT NULL,
                    menu_id BIGINT NOT NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_role_menu (role_id, menu_id),
                    INDEX idx_role_id (role_id),
                    INDEX idx_menu_id (menu_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS sys_role_dept (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    role_id BIGINT NOT NULL,
                    dept_id BIGINT NOT NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_role_dept (role_id, dept_id),
                    INDEX idx_role_id (role_id),
                    INDEX idx_dept_id (dept_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);

        addColumnIfMissing("sys_role", "data_scope", "TINYINT DEFAULT 1");
        addColumnIfMissing("sys_role", "menu_check_strictly", "TINYINT DEFAULT 1");
        addColumnIfMissing("sys_role", "dept_check_strictly", "TINYINT DEFAULT 1");
        addColumnIfMissing("sys_dept", "ancestors", "VARCHAR(512) DEFAULT ''");
        addColumnIfMissing("sys_dept", "email", "VARCHAR(128)");
        addColumnIfMissing("sys_user", "login_ip", "VARCHAR(128)");
        addColumnIfMissing("sys_user", "login_date", "DATETIME");
        addColumnIfMissing("sys_user", "remark", "VARCHAR(512)");

        jdbcTemplate.update("UPDATE sys_dept SET ancestors = '0' WHERE id = 1 AND (ancestors IS NULL OR ancestors = '')");

        seedMenus();
        seedSuperAdminMenus();
    }

    private void addColumnIfMissing(String tableName, String columnName, String definition) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = ?
                  AND column_name = ?
                """, Integer.class, tableName, columnName);
        if (count == null || count == 0) {
            jdbcTemplate.execute("ALTER TABLE " + tableName + " ADD COLUMN " + columnName + " " + definition);
        }
    }

    private void addIndexIfMissing(String tableName, String indexName, String columnName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                  AND table_name = ?
                  AND index_name = ?
                """, Integer.class, tableName, indexName);
        if (count == null || count == 0) {
            jdbcTemplate.execute("ALTER TABLE " + tableName + " ADD INDEX " + indexName + " (" + columnName + ")");
        }
    }

    private void dropIndexIfExists(String tableName, String indexName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                  AND table_name = ?
                  AND index_name = ?
                """, Integer.class, tableName, indexName);
        if (count != null && count > 0) {
            jdbcTemplate.execute("ALTER TABLE " + tableName + " DROP INDEX " + indexName);
        }
    }

    private void seedMenus() {
        jdbcTemplate.execute("""
                INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, path, component, menu_type, perms, icon, visible, status) VALUES
                    (1, '系统管理', 0, 1, 'system', NULL, 'M', NULL, 'settings', 1, 1),
                    (2, '用户管理', 1, 1, 'user', 'system/user/index', 'C', 'system:user:list', 'user', 1, 1),
                    (3, '用户查询', 2, 1, NULL, NULL, 'F', 'system:user:query', NULL, 1, 1),
                    (4, '用户新增', 2, 2, NULL, NULL, 'F', 'system:user:add', NULL, 1, 1),
                    (5, '用户编辑', 2, 3, NULL, NULL, 'F', 'system:user:edit', NULL, 1, 1),
                    (6, '用户删除', 2, 4, NULL, NULL, 'F', 'system:user:delete', NULL, 1, 1),
                    (7, '角色管理', 1, 2, 'role', 'system/role/index', 'C', 'system:role:list', 'shield', 1, 1),
                    (8, '角色查询', 7, 1, NULL, NULL, 'F', 'system:role:query', NULL, 1, 1),
                    (9, '角色新增', 7, 2, NULL, NULL, 'F', 'system:role:add', NULL, 1, 1),
                    (10, '角色编辑', 7, 3, NULL, NULL, 'F', 'system:role:edit', NULL, 1, 1),
                    (11, '角色删除', 7, 4, NULL, NULL, 'F', 'system:role:delete', NULL, 1, 1),
                    (12, '部门管理', 1, 3, 'dept', 'system/dept/index', 'C', 'system:dept:list', 'building', 1, 1),
                    (13, '部门查询', 12, 1, NULL, NULL, 'F', 'system:dept:query', NULL, 1, 1),
                    (14, '部门新增', 12, 2, NULL, NULL, 'F', 'system:dept:add', NULL, 1, 1),
                    (15, '部门编辑', 12, 3, NULL, NULL, 'F', 'system:dept:edit', NULL, 1, 1),
                    (16, '部门删除', 12, 4, NULL, NULL, 'F', 'system:dept:delete', NULL, 1, 1),
                    (17, '菜单管理', 1, 4, 'menu', 'system/menu/index', 'C', 'system:menu:list', 'menu', 1, 1),
                    (18, '菜单查询', 17, 1, NULL, NULL, 'F', 'system:menu:query', NULL, 1, 1),
                    (19, '菜单新增', 17, 2, NULL, NULL, 'F', 'system:menu:add', NULL, 1, 1),
                    (20, '菜单编辑', 17, 3, NULL, NULL, 'F', 'system:menu:edit', NULL, 1, 1),
                    (21, '菜单删除', 17, 4, NULL, NULL, 'F', 'system:menu:delete', NULL, 1, 1),
                    (22, '工作流定义', 1, 5, 'workflow-definition', 'system/workflow/index', 'C', 'workflow:definition:list', 'workflow', 1, 1),
                    (23, '工作流查询', 22, 1, NULL, NULL, 'F', 'workflow:definition:query', NULL, 1, 1),
                    (24, '工作流编辑', 22, 2, NULL, NULL, 'F', 'workflow:definition:edit', NULL, 1, 1),
                    (30, '岗位管理', 1, 6, 'post', 'system/post/index', 'C', 'system:post:list', 'briefcase', 1, 1),
                    (31, '岗位查询', 30, 1, NULL, NULL, 'F', 'system:post:query', NULL, 1, 1),
                    (32, '岗位新增', 30, 2, NULL, NULL, 'F', 'system:post:add', NULL, 1, 1),
                    (33, '岗位编辑', 30, 3, NULL, NULL, 'F', 'system:post:edit', NULL, 1, 1),
                    (34, '岗位删除', 30, 4, NULL, NULL, 'F', 'system:post:delete', NULL, 1, 1),
                    (100, '资产管理', 0, 2, NULL, NULL, 'M', NULL, 'package', 1, 1),
                    (101, '资产台账', 100, 1, NULL, NULL, 'C', 'asset:ledger:query', 'list', 1, 1),
                    (102, '资产查询', 101, 1, NULL, NULL, 'F', 'asset:ledger:query', NULL, 1, 1),
                    (103, '资产创建', 101, 2, NULL, NULL, 'F', 'asset:ledger:create', NULL, 1, 1),
                    (104, '资产编辑', 101, 3, NULL, NULL, 'F', 'asset:ledger:edit', NULL, 1, 1),
                    (105, '资产删除', 101, 4, NULL, NULL, 'F', 'asset:ledger:delete', NULL, 1, 1),
                    (106, '资产分类', 100, 2, NULL, NULL, 'C', 'asset:category:query', 'grid', 1, 1),
                    (107, '分类查询', 106, 1, NULL, NULL, 'F', 'asset:category:query', NULL, 1, 1),
                    (108, '分类创建', 106, 2, NULL, NULL, 'F', 'asset:category:create', NULL, 1, 1),
                    (109, '分类编辑', 106, 3, NULL, NULL, 'F', 'asset:category:edit', NULL, 1, 1),
                    (110, '分类删除', 106, 4, NULL, NULL, 'F', 'asset:category:delete', NULL, 1, 1),
                    (111, '维修管理', 100, 3, NULL, NULL, 'C', 'asset:maintenance:query', 'tool', 1, 1),
                    (112, '维修查询', 111, 1, NULL, NULL, 'F', 'asset:maintenance:query', NULL, 1, 1),
                    (113, '维修创建', 111, 2, NULL, NULL, 'F', 'asset:maintenance:create', NULL, 1, 1),
                    (114, '维修编辑', 111, 3, NULL, NULL, 'F', 'asset:maintenance:edit', NULL, 1, 1),
                    (115, '维修删除', 111, 4, NULL, NULL, 'F', 'asset:maintenance:delete', NULL, 1, 1),
                    (116, '退役管理', 100, 4, NULL, NULL, 'C', 'asset:retirement:query', 'archive', 1, 1),
                    (117, '退役查询', 116, 1, NULL, NULL, 'F', 'asset:retirement:query', NULL, 1, 1),
                    (118, '退役申请', 116, 2, NULL, NULL, 'F', 'asset:retirement:create', NULL, 1, 1),
                    (119, '退役提交', 116, 3, NULL, NULL, 'F', 'asset:retirement:submit', NULL, 1, 1),
                    (120, '退役审批', 116, 4, NULL, NULL, 'F', 'asset:retirement:approve', NULL, 1, 1),
                    (121, '退役驳回', 116, 5, NULL, NULL, 'F', 'asset:retirement:reject', NULL, 1, 1),
                    (122, '退役完成', 116, 6, NULL, NULL, 'F', 'asset:retirement:complete', NULL, 1, 1),
                    (123, '退役取消', 116, 7, NULL, NULL, 'F', 'asset:retirement:cancel', NULL, 1, 1),
                    (124, '退役删除', 116, 8, NULL, NULL, 'F', 'asset:retirement:delete', NULL, 1, 1),
                    (210, '退役编辑', 116, 9, NULL, NULL, 'F', 'asset:retirement:edit', NULL, 1, 1),
                    (125, '盘点管理', 100, 5, NULL, NULL, 'C', 'inventory:query', 'scan', 1, 1),
                    (126, '盘点查询', 125, 1, NULL, NULL, 'F', 'inventory:query', NULL, 1, 1),
                    (127, '盘点创建', 125, 2, NULL, NULL, 'F', 'inventory:create', NULL, 1, 1),
                    (128, '盘点扫描', 125, 3, NULL, NULL, 'F', 'inventory:scan', NULL, 1, 1),
                    (129, '盘点提交', 125, 4, NULL, NULL, 'F', 'inventory:submit', NULL, 1, 1),
                    (130, '闲置资产', 100, 6, NULL, NULL, 'C', 'idle:query', 'share', 1, 1),
                    (131, '闲置查询', 130, 1, NULL, NULL, 'F', 'idle:query', NULL, 1, 1),
                    (132, '闲置发布', 130, 2, NULL, NULL, 'F', 'idle:create', NULL, 1, 1),
                    (133, '闲置认领', 130, 3, NULL, NULL, 'F', 'idle:claim', NULL, 1, 1),
                    (211, '认领审批', 130, 4, NULL, NULL, 'F', 'idle:approve', NULL, 1, 1),
                    (134, '闲置取消', 130, 5, NULL, NULL, 'F', 'idle:cancel', NULL, 1, 1),
                    (135, '闲置删除', 130, 6, NULL, NULL, 'F', 'idle:delete', NULL, 1, 1),
                    (136, '资产赔偿', 100, 7, NULL, NULL, 'C', 'compensation:query', 'dollar-sign', 1, 1),
                    (137, '赔偿查询', 136, 1, NULL, NULL, 'F', 'compensation:query', NULL, 1, 1),
                    (138, '赔偿创建', 136, 2, NULL, NULL, 'F', 'compensation:create', NULL, 1, 1),
                    (139, '赔偿编辑', 136, 3, NULL, NULL, 'F', 'compensation:edit', NULL, 1, 1),
                    (140, '赔偿删除', 136, 4, NULL, NULL, 'F', 'compensation:delete', NULL, 1, 1),
                    (141, '折旧管理', 100, 8, NULL, NULL, 'C', 'depreciation:query', 'trending-down', 1, 1),
                    (142, '折旧查询', 141, 1, NULL, NULL, 'F', 'depreciation:query', NULL, 1, 1),
                    (143, '折旧计算', 141, 2, NULL, NULL, 'F', 'depreciation:calculate', NULL, 1, 1),
                    (144, '资产处置', 100, 9, NULL, NULL, 'C', 'disposal:query', 'trash', 1, 1),
                    (145, '处置查询', 144, 1, NULL, NULL, 'F', 'disposal:query', NULL, 1, 1),
                    (146, '资产转移', 144, 2, NULL, NULL, 'F', 'disposal:transfer', NULL, 1, 1),
                    (147, '资产清退', 144, 3, NULL, NULL, 'F', 'disposal:clearance', NULL, 1, 1),
                    (148, '资产报废', 144, 4, NULL, NULL, 'F', 'disposal:scrap', NULL, 1, 1),
                    (150, '审批管理', 0, 3, NULL, NULL, 'M', NULL, 'check-circle', 1, 1),
                    (151, '审批流程', 150, 1, NULL, NULL, 'C', 'approval:process:query', 'file-text', 1, 1),
                    (152, '审批查询', 151, 1, NULL, NULL, 'F', 'approval:process:query', NULL, 1, 1),
                    (153, '审批发起', 151, 2, NULL, NULL, 'F', 'approval:process:create', NULL, 1, 1),
                    (154, '审批通过', 151, 3, NULL, NULL, 'F', 'approval:process:approve', NULL, 1, 1),
                    (155, '审批驳回', 151, 4, NULL, NULL, 'F', 'approval:process:reject', NULL, 1, 1),
                    (156, '审批取消', 151, 5, NULL, NULL, 'F', 'approval:process:cancel', NULL, 1, 1),
                    (160, '工单管理', 0, 4, NULL, NULL, 'M', NULL, 'clipboard', 1, 1),
                    (161, '工单列表', 160, 1, NULL, NULL, 'C', 'workorder:order:query', 'list-checks', 1, 1),
                    (162, '工单查询', 161, 1, NULL, NULL, 'F', 'workorder:order:query', NULL, 1, 1),
                    (163, '工单创建', 161, 2, NULL, NULL, 'F', 'workorder:order:create', NULL, 1, 1),
                    (164, '工单编辑', 161, 3, NULL, NULL, 'F', 'workorder:order:edit', NULL, 1, 1),
                    (165, '工单删除', 161, 4, NULL, NULL, 'F', 'workorder:order:delete', NULL, 1, 1),
                    (166, '工单提交', 161, 5, NULL, NULL, 'F', 'workorder:order:submit', NULL, 1, 1),
                    (167, '工单审批', 161, 6, NULL, NULL, 'F', 'workorder:order:approve', NULL, 1, 1),
                    (168, '工单驳回', 161, 7, NULL, NULL, 'F', 'workorder:order:reject', NULL, 1, 1),
                    (170, '基础数据', 0, 5, NULL, NULL, 'M', NULL, 'database', 1, 1),
                    (171, '位置管理', 170, 1, NULL, NULL, 'C', 'location:query', 'map-pin', 1, 1),
                    (172, '位置查询', 171, 1, NULL, NULL, 'F', 'location:query', NULL, 1, 1),
                    (173, '位置创建', 171, 2, NULL, NULL, 'F', 'location:create', NULL, 1, 1),
                    (174, '位置编辑', 171, 3, NULL, NULL, 'F', 'location:edit', NULL, 1, 1),
                    (175, '位置删除', 171, 4, NULL, NULL, 'F', 'location:delete', NULL, 1, 1),
                    (176, '供应商管理', 170, 2, NULL, NULL, 'C', 'vendor:vendor:query', 'truck', 1, 1),
                    (177, '供应商查询', 176, 1, NULL, NULL, 'F', 'vendor:vendor:query', NULL, 1, 1),
                    (178, '供应商新增', 176, 2, NULL, NULL, 'F', 'vendor:vendor:add', NULL, 1, 1),
                    (179, '供应商编辑', 176, 3, NULL, NULL, 'F', 'vendor:vendor:edit', NULL, 1, 1),
                    (180, '供应商删除', 176, 4, NULL, NULL, 'F', 'vendor:vendor:delete', NULL, 1, 1),
                    (185, '报表统计', 0, 6, NULL, NULL, 'M', NULL, 'bar-chart', 1, 1),
                    (186, '仪表盘', 185, 1, NULL, NULL, 'C', 'dashboard:query', 'gauge', 1, 1),
                    (187, '仪表盘查询', 186, 1, NULL, NULL, 'F', 'dashboard:query', NULL, 1, 1),
                    (188, '报表中心', 185, 2, NULL, NULL, 'C', 'report:query', 'file-bar-chart', 1, 1),
                    (189, '报表查询', 188, 1, NULL, NULL, 'F', 'report:query', NULL, 1, 1),
                    (190, '统计概览', 185, 3, NULL, NULL, 'C', 'stats:query', 'pie-chart', 1, 1),
                    (191, '统计查询', 190, 1, NULL, NULL, 'F', 'stats:query', NULL, 1, 1),
                    (192, '大屏展示', 185, 4, NULL, NULL, 'C', 'bigscreen:query', 'monitor', 1, 1),
                    (193, '大屏查询', 192, 1, NULL, NULL, 'F', 'bigscreen:query', NULL, 1, 1),
                    (194, '审计日志', 185, 5, NULL, NULL, 'C', 'audit:query', 'search-code', 1, 1),
                    (195, '审计查询', 194, 1, NULL, NULL, 'F', 'audit:query', NULL, 1, 1),
                    (200, '其他功能', 0, 7, NULL, NULL, 'M', NULL, 'more-horizontal', 1, 1),
                    (201, '通知管理', 200, 1, NULL, NULL, 'C', NULL, 'bell', 1, 1),
                    (209, '通知查询', 201, 0, NULL, NULL, 'F', 'notification:query', NULL, 1, 1),
                    (202, '通知已读', 201, 1, NULL, NULL, 'F', 'notification:read', NULL, 1, 1),
                    (203, '通知删除', 201, 2, NULL, NULL, 'F', 'notification:delete', NULL, 1, 1),
                    (204, '全局搜索', 200, 2, NULL, NULL, 'C', 'search:query', 'search', 1, 1),
                    (205, '搜索查询', 204, 1, NULL, NULL, 'F', 'search:query', NULL, 1, 1),
                    (206, '系统配置', 200, 3, NULL, NULL, 'C', 'system:config:query', 'settings', 1, 1),
                    (207, '配置查询', 206, 1, NULL, NULL, 'F', 'system:config:query', NULL, 1, 1),
                    (208, '配置编辑', 206, 2, NULL, NULL, 'F', 'system:config:edit', NULL, 1, 1)
                ON DUPLICATE KEY UPDATE
                    menu_name = VALUES(menu_name),
                    parent_id = VALUES(parent_id),
                    sort_order = VALUES(sort_order),
                    path = VALUES(path),
                    component = VALUES(component),
                    menu_type = VALUES(menu_type),
                    perms = VALUES(perms),
                    icon = VALUES(icon),
                    visible = VALUES(visible),
                    status = VALUES(status)
                """);
    }

    private void seedSuperAdminMenus() {
        List<Integer> menuIds = List.of(
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
                22, 23, 24, 30, 31, 32, 33, 34,
                100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115,
                116, 117, 118, 119, 120, 121, 122, 123, 124, 210, 125, 126, 127, 128, 129,
                130, 131, 132, 133, 211, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144,
                145, 146, 147, 148, 150, 151, 152, 153, 154, 155, 156, 160, 161, 162, 163,
                164, 165, 166, 167, 168, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179,
                180, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 200, 201, 202,
                203, 209, 204, 205, 206, 207, 208
        );
        jdbcTemplate.batchUpdate(
                "INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, ?)",
                menuIds,
                100,
                (ps, menuId) -> ps.setInt(1, menuId)
        );
    }
}
