package com.ams.migration;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class WorkflowDefinitionDraftMigrationTest {

    @Test
    void draftMigrationIsAppendOnlyAndDoesNotSeedIdentityOrApprovers() throws IOException {
        String migration = read("migration/V2_116__workflow_definition_draft.sql");

        assertThat(migration)
                .contains("CREATE TABLE IF NOT EXISTS workflow_definition_draft")
                .contains("uk_workflow_draft_tenant_business")
                .doesNotContain("INSERT ")
                .doesNotContain("sys_user")
                .doesNotContain("sys_role")
                .doesNotContain("SUPER_ADMIN")
                .doesNotContain("ALTER TABLE")
                .doesNotContain("DROP TABLE");
    }

    @Test
    void freshBaselineContainsSameDraftTableForStagedChainIdempotence() throws IOException {
        String schema = read("schema.sql");

        assertThat(schema)
                .contains("CREATE TABLE IF NOT EXISTS workflow_definition_draft")
                .contains("uk_workflow_draft_tenant_business")
                .contains("revision INT NOT NULL DEFAULT 0");
    }

    @Test
    void legacyDraftMigrationCopiesOnlyDraftRowsWithoutOverwritingExistingDrafts() throws IOException {
        String migration = read("migration/V2_118__migrate_legacy_workflow_definition_drafts.sql");

        assertThat(migration)
                .contains("INSERT IGNORE INTO workflow_definition_draft")
                .contains("tenant_id, business_type, name, description, definition_json, revision, updated_by")
                .contains("COALESCE(version, 0)")
                .contains("updated_by")
                .contains("create_time, update_time")
                .contains("WHERE status = 'DRAFT'")
                .contains("COALESCE(deleted, 0) = 0")
                .doesNotContain("UPDATE workflow_definition")
                .doesNotContain("DELETE FROM workflow_definition");
    }

    private String read(String path) throws IOException {
        ClassPathResource resource = new ClassPathResource(path);
        return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    }
}
