package com.ams.config;

import com.ams.context.TenantContext;
import com.baomidou.mybatisplus.extension.plugins.handler.TenantLineHandler;
import net.sf.jsqlparser.expression.Expression;
import net.sf.jsqlparser.expression.StringValue;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class TenantFilter implements TenantLineHandler {

    private static final Logger log = LoggerFactory.getLogger(TenantFilter.class);

    @Override
    public Expression getTenantId() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            log.warn("tenant_id_missing action=getTenantId fallback=default — likely a scheduled task or unauthenticated request");
            return new StringValue("default");
        }
        return new StringValue(tenantId);
    }

    @Override
    public String getTenantIdColumn() {
        return "tenant_id";
    }

    @Override
    public boolean ignoreTable(String tableName) {
        return tableName.startsWith("sys_") || tableName.startsWith("bpm_")
                || tableName.equals("sam_compliance_scan") || tableName.equals("sam_compliance_detail")
                || tableName.equals("energy_meter") || tableName.equals("energy_consumption")
                || tableName.equals("floor_plan") || tableName.equals("floor_plan_asset")
                /* location 表 CTE 查询中 JOIN 带 tenant_id 别名，但拦截器生成无别名的 tenant_id 导致 ON 子句歧义 */
                || tableName.equals("location")
                /* CTE 递归别名 — 拦截器在 CTE 产出上无法加 tenant_id 过滤 */
                || tableName.equals("cte");
    }
}
