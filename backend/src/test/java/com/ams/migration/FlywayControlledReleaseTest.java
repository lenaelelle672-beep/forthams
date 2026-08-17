package com.ams.migration;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FlywayControlledReleaseTest {

    private static final List<String> HISTORICAL_FILES_WITH_IMMUTABLE_TYPO = List.of(
            "V2_104__sys_tenant_append_only.sql",
            "V2_106__import_export_task_append_only.sql",
            "V2_107__handover_append_only.sql",
            "V2_108__workflow_mail_append_only.sql",
            "V2_109__doc_center_append_only.sql",
            "V2_110__tech_support_append_only.sql");

    private static final List<String> HISTORICAL_FILES_WITH_UNQUOTED_SENSITIVE_IDENTIFIER = List.of(
            "V2_87__form_storage_append_only.sql",
            "V2_89__todo_field_config_append_only.sql");

    private static final List<String> HISTORICAL_FILES_WITH_UNSUPPORTED_CREATE_INDEX_IF_NOT_EXISTS = List.of(
            "V2_94__notification_template_append_only.sql",
            "V2_95__mail_template_append_only.sql",
            "V2_96__mail_log_append_only.sql",
            "V2_97__custom_field_append_only.sql",
            "V2_98__custom_fieldset_append_only.sql",
            "V2_99__notification_preference_append_only.sql",
            "V2_100__channel_config_append_only.sql",
            "V2_101__notification_switch_append_only.sql");

    @Test
    void historicalMigrationSourcesRemainImmutableAndFreshReleaseUsesStagedCopies() throws IOException {
        for (String filename : HISTORICAL_FILES_WITH_IMMUTABLE_TYPO) {
            String migration = readMigration(filename);
            assertThat(migration).contains("utf4mb4");
        }
        assertThat(readMigration("V2_112__tenant_data_permission_authority.sql"))
                .contains("DEFAULT CHARSET=utf8mb4");
        for (String filename : HISTORICAL_FILES_WITH_UNQUOTED_SENSITIVE_IDENTIFIER) {
            assertThat(readMigration(filename)).contains("sensitive TINYINT DEFAULT 0");
        }
        for (String filename : HISTORICAL_FILES_WITH_UNSUPPORTED_CREATE_INDEX_IF_NOT_EXISTS) {
            assertThat(readMigration(filename)).contains("CREATE INDEX IF NOT EXISTS");
        }
    }

    @Test
    void freshChainToolHasAnExplicitAllowlistAndReadonlyPreflightNeverMutatesDatabase() throws IOException {
        String freshChainTool = java.nio.file.Files.readString(java.nio.file.Path.of(
                "scripts/prepare-fresh-flyway-chain.sh"), StandardCharsets.UTF_8);
        String preflightTool = java.nio.file.Files.readString(java.nio.file.Path.of(
                "scripts/flyway-readonly-preflight.sh"), StandardCharsets.UTF_8);
        String approvedTargetTool = java.nio.file.Files.readString(java.nio.file.Path.of(
                "scripts/flyway-approved-target.sh"), StandardCharsets.UTF_8);
        String migrateTool = java.nio.file.Files.readString(java.nio.file.Path.of(
                "scripts/flyway-dba-migrate.sh"), StandardCharsets.UTF_8);
        String scriptTest = java.nio.file.Files.readString(java.nio.file.Path.of(
                "scripts/test-flyway-controlled-release.sh"), StandardCharsets.UTF_8);

        for (String filename : HISTORICAL_FILES_WITH_IMMUTABLE_TYPO) {
            assertThat(freshChainTool).contains(filename);
        }
        for (String filename : HISTORICAL_FILES_WITH_UNQUOTED_SENSITIVE_IDENTIFIER) {
            assertThat(freshChainTool).contains(filename);
        }
        for (String filename : HISTORICAL_FILES_WITH_UNSUPPORTED_CREATE_INDEX_IF_NOT_EXISTS) {
            assertThat(freshChainTool).contains(filename);
        }
        assertThat(freshChainTool)
                .contains("schema.sql")
                .contains("V0_1__menu_prerequisite_schema.sql")
                .contains("V1_0__baseline_schema.sql")
                .contains("remove-fixed-schema-selection")
                .contains("MANIFEST.tsv")
                .contains("utf4mb4-to-utf8mb4")
                .contains("quote-sensitive-identifier")
                .contains("remove-create-index-if-not-exists");
        assertThat(preflightTool)
                .contains("run_approved_fresh_schema_preflight")
                .contains("从不执行 migrate、repair")
                .contains("verify_staged_manifest");
        assertThat(approvedTargetTool)
                .contains("APPROVED_STAGED_MANIFEST_SHA256")
                .contains("sslMode=VERIFY_IDENTITY")
                .contains("VERIFY_IDENTITY")
                .contains("staged SQL SHA-256")
                .contains("APPROVED_FLYWAY_HOST")
                .contains("APPROVED_FLYWAY_PORT")
                .contains("APPROVED_FLYWAY_SCHEMA")
                .contains("APPROVED_STAGED_SNAPSHOT_DIR")
                .contains("--defaults-file")
                .contains("env -i")
                .contains("O_NOFOLLOW")
                .contains("run_approved_flyway \"$flyway_bin\" info")
                .contains("run_approved_flyway \"$flyway_bin\" validate");
        assertThat(migrateTool)
                .contains("run_approved_fresh_schema_preflight")
                .contains("run_approved_flyway \"$flyway_bin\" migrate")
                .doesNotContain("flyway-readonly-preflight.sh");
        assertThat(scriptTest)
                .contains("init-command=SELECT 1")
                .contains("DBA_RELEASE_AUTHORIZATION")
                .contains("同一受保护快照");
    }

    @Test
    void applicationStartupDoesNotPerformAutomaticDatabaseChanges() throws IOException {
        String applicationConfig = java.nio.file.Files.readString(java.nio.file.Path.of(
                "src/main/resources/application.yml"), StandardCharsets.UTF_8);

        assertThat(applicationConfig)
                .contains("ddl-auto: none")
                .contains("spring.flyway.enabled: false")
                .contains("spring.flyway.baseline-on-migrate: false");
    }

    private String readMigration(String filename) throws IOException {
        ClassPathResource resource = new ClassPathResource("migration/" + filename);
        return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    }
}
