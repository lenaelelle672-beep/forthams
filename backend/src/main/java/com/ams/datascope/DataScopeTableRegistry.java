package com.ams.datascope;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;

@Component
public class DataScopeTableRegistry {

    private static final Map<String, FieldMapping> REGISTRY = Map.ofEntries(
            Map.entry("asset", new FieldMapping("dept_id", "create_by")),
            Map.entry("work_order", new FieldMapping("dept_id", "reporter_id")),
            Map.entry("retirement_application", new FieldMapping("dept_id", "applicant_id")),
            Map.entry("idle_asset_notice", new FieldMapping(null, "create_by")),
            Map.entry("maintenance_record", new FieldMapping(null, "create_by")),
            Map.entry("asset_compensation", new FieldMapping("responsible_dept_id", "responsible_user_id")),
            Map.entry("approval_process", new FieldMapping(null, "applicant_id")),
            Map.entry("inventory_task", new FieldMapping(null, "create_by")),
            Map.entry("general_audit_entry", new FieldMapping(null, "operator_id")),
            Map.entry("sys_operate_log", new FieldMapping(null, "operator_id")),
            Map.entry("asset_change_log", new FieldMapping(null, "operator_id"))
    );

    public FieldMapping get(String tableName) {
        return tableName != null ? REGISTRY.get(tableName.toLowerCase()) : null;
    }

    public Set<String> registeredTables() {
        return REGISTRY.keySet();
    }

    public record FieldMapping(String deptColumn, String userColumn) {}
}
