package com.ams.config;

import com.ams.context.TenantContext;
import com.ams.datascope.AmsDataPermissionHandler;
import com.ams.datascope.DataScopeDecisionService;
import com.ams.datascope.DataScopeTableRegistry;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.RoleMapper;
import com.ams.mapper.SysRoleDeptMapper;
import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.DataPermissionInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.OptimisticLockerInnerInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.TenantLineInnerInterceptor;
import net.sf.jsqlparser.expression.Expression;
import net.sf.jsqlparser.expression.StringValue;
import net.sf.jsqlparser.schema.Column;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;
import java.util.List;

/**
 * MyBatis-Plus 全局配置（gai2 W3 IMP-1 路径锁定 / AR-2 顺序 / R12 多租户根治 / builder 2026-06-03 实装）。
 *
 * <p>blast_radius（AR-6 注释）：</p>
 * <ul>
 *   <li>本类位于 {@code backend/src/main/java/com/ams/config/MyBatisPlusConfig.java}（大写 B，Java 严格区分大小写）</li>
 *   <li>保留 OptimisticLocker / DataPermission / Pagination / TenantLine 拦截器链</li>
 *   <li>所有 SQL 自动追加 {@code WHERE tenant_id = ?}；白名单表（location / asset_category / sys_* / qrtz_* 等）保持原行为</li>
 *   <li>与 AssetService 手写 {@code .eq(Asset::getTenantId, TenantContext.requireTenantId())} 共存 1-2 迭代作双重保险（RR-1 低危）</li>
 * </ul>
 */
@Configuration
public class MyBatisPlusConfig {

    /**
     * 忽略多租户拦截的白名单表（系统表 / 配置表 / 任务调度表 / 字典 / 位置树 / 资产分类等不含 tenant_id）。
     * 维护要点：漏配含 tenant_id 的非业务表会误过滤、漏配未含 tenant_id 的业务表会泄漏。
     */
    private static final List<String> TENANT_IGNORE_TABLES = Arrays.asList(
            "flyway_schema_history",
            "sys_config",
            "sys_tenant",
            "sys_menu",
            "sys_role",
            "sys_role_menu",
            "sys_role_dept",
            "sys_dept",
            "sys_user_role",
            "sys_user",
            "sys_user_post",
            "sys_post",
            "sys_dict_type",
            "sys_dict_data",
            "sys_notice",
            "sys_log",
            "sys_operate_log",
            "sys_login_log",
            "qrtz_*",
            "schedule_job",
            "schedule_job_log",
            "location",
            "asset_category",
            "notification",
            "manufacturer",
            "vendor",
            "contract",
            "workflow_node",
            "workflow_edge",
            "bpm_mail_config",
            // CTE 派生表（location 树递归查询）— MyBatis-Plus 拦截器对派生表追加 WHERE 时会失败
            "cte",
            "recursive_cte"
    );

    /**
     * 注册 MyBatis-Plus 拦截器链（W3 实施 + AR-2 顺序锁定 + R12 根治）。
     *
     * <p><strong>顺序（关键 — 不可调整）</strong>：</p>
     * <ol>
     *   <li>OptimisticLockerInnerInterceptor：乐观锁 — 先补齐 {@code @Version} 更新参数</li>
     *   <li>DataPermissionInterceptor：数据权限（部门/角色）— 先于租户过滤，
     *       让 dept_id IN (...) 也能正常拼装，避免被租户拦截器当作外键条件截断</li>
     *   <li>PaginationInnerInterceptor：分页</li>
     *   <li>TenantLineInnerInterceptor：多租户 SQL 改写（R12 治本），
     *       <strong>MyBatis-Plus 文档建议放最内层</strong>，避免嵌套查询被父拦截器误改写</li>
     * </ol>
     */
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor(
            DataScopeDecisionService decisionService,
            DataScopeTableRegistry tableRegistry,
            ObjectProvider<DeptMapper> deptMapper,
            ObjectProvider<RoleMapper> roleMapper,
            ObjectProvider<SysRoleDeptMapper> sysRoleDeptMapper) {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        AmsDataPermissionHandler handler = new AmsDataPermissionHandler(
                decisionService, tableRegistry, deptMapper, roleMapper, sysRoleDeptMapper);
        // 1) 乐观锁：为 @Version 实体补齐 MP_OPTLOCK_VERSION_ORIGINAL 参数
        interceptor.addInnerInterceptor(new OptimisticLockerInnerInterceptor());
        // 2) 数据权限：先于租户过滤
        interceptor.addInnerInterceptor(new DataPermissionInterceptor(handler));
        // 3) 分页
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        // 4) 多租户：MyBatis-Plus 文档建议 TenantLineInnerInterceptor 放最内层
        interceptor.addInnerInterceptor(buildTenantLineInnerInterceptor());
        return interceptor;
    }

    /**
     * 构建 TenantLineInnerInterceptor：从 TenantContext 读 tenantId，白名单表放行，
     * insert 阶段仅在 Service 层显式写入 tenant_id 列时跳过自动注入。
     *
     * <p><strong>关键约束（CTE 派生表处理）</strong>：{@code @Select} 注解的 {@code WITH RECURSIVE cte} SQL
     * 会被 jsqlparser 解析为派生表 MyBatis-Plus TenantLineInnerInterceptor 会向其追加
     * {@code AND tenant_id = ?} 但 aliasColumn 不带表名前缀,例如:</p>
     * <pre>
     *   WITH RECURSIVE cte AS (
     *     SELECT id, name, parent_id FROM location WHERE id = ?      -- 无 tenant_id 注入（被白名单）
     *     UNION ALL
     *     SELECT l.id, l.name, l.parent_id FROM location l
     *     INNER JOIN cte ON l.parent_id = cte.id AND tenant_id = 0   -- 这里出 bug
     *   ) SELECT * FROM cte WHERE tenant_id = 0
     * </pre>
     * <p>解决方案：</p>
     * <ol>
     *   <li>{@code getTenantId()} 返回 {@code StringValue("dept:1")} 等真实 tenantId（VARCHAR 适配）</li>
     *   <li>{@code location} / {@code asset_category} 等树/分类表加入白名单</li>
     *   <li>Service 层避免用 CTE — 改用 application-level recursion（{@code LocationService.getCascadeIds}）</li>
     * </ol>
     */
    private TenantLineInnerInterceptor buildTenantLineInnerInterceptor() {
        return new TenantLineInnerInterceptor(new com.baomidou.mybatisplus.extension.plugins.handler.TenantLineHandler() {
            @Override
            public Expression getTenantId() {
                String tenantId = TenantContext.requireTenantId();
                // VARCHAR 适配：asset.tenant_id = "dept:1"（不可 fallback 到数字 0，否则 WHERE 永远 false）
                return new StringValue(tenantId);
            }

            @Override
            public String getTenantIdColumn() {
                return "tenant_id";
            }

            @Override
            public boolean ignoreTable(String tableName) {
                if (tableName == null) {
                    return true;
                }
                String lower = tableName.toLowerCase();
                for (String ignore : TENANT_IGNORE_TABLES) {
                    if (lower.equals(ignore) || lower.startsWith(ignore.replace("*", ""))) {
                        return true;
                    }
                }
                return false;
            }

            @Override
            public boolean ignoreInsert(List<Column> columns, String tenantIdColumn) {
                // 已显式包含 tenant_id 时避免重复注入；否则由拦截器从 TenantContext 自动填充。
                return columns != null && columns.stream()
                        .anyMatch(column -> tenantIdColumn.equalsIgnoreCase(column.getColumnName()));
            }
        });
    }
}
