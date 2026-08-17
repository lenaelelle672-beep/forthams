package com.ams.migration;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class ApprovalRecoveryMigrationTest {

    @Test
    void migrationCancelsOnlyPendingProcessesWithoutATrustedCurrentAssignment() throws IOException {
        String migration = read("migration/V2_120__cancel_unassigned_pending_approvals.sql");

        assertThat(migration)
                .contains("cancellation_reason VARCHAR(128)")
                .contains("cancelled_at DATETIME")
                .contains("status = 'PENDING'")
                .contains("current_assignment.process_id = approval_process.id")
                .contains("current_assignment.step_no = approval_process.current_step")
                .contains("current_assignment.status = 'PENDING'")
                .contains("definition_version.definition_id = current_assignment.workflow_definition_id")
                .contains("definition_version.version = current_assignment.workflow_version")
                .contains("definition_version.status = 'PUBLISHED'")
                .contains("CANCELLED_REQUIRES_RESUBMISSION")
                .contains("MISSING_TRUSTED_CURRENT_ASSIGNMENT")
                .contains("UPDATE approval_node_assignment ana")
                .doesNotContain("INSERT INTO approval_node_assignment")
                .doesNotContain("INSERT INTO workflow_definition");
    }

    @Test
    void freshSchemaRetainsCancellationAuditColumns() throws IOException {
        String schema = read("schema.sql");

        assertThat(schema)
                .contains("cancellation_reason VARCHAR(128)")
                .contains("cancelled_at DATETIME");
    }

    private String read(String path) throws IOException {
        ClassPathResource resource = new ClassPathResource(path);
        return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    }
}
