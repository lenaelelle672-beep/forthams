-- V2_120__cancel_unassigned_pending_approvals
-- 历史 PENDING 流程没有提交时冻结的可信当前节点时，不能按当前流程定义补建处理人。
-- 前向取消保留原因和时间；申请人随后通过受控重提链创建新的处理人快照。
SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'approval_process')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND column_name = 'cancellation_reason'),
    'ALTER TABLE approval_process ADD COLUMN cancellation_reason VARCHAR(128) NULL AFTER status', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'approval_process')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND column_name = 'cancelled_at'),
    'ALTER TABLE approval_process ADD COLUMN cancelled_at DATETIME NULL AFTER cancellation_reason', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE approval_process
SET status = 'CANCELLED_REQUIRES_RESUBMISSION',
    cancellation_reason = 'MISSING_TRUSTED_CURRENT_ASSIGNMENT',
    cancelled_at = CURRENT_TIMESTAMP,
    version = COALESCE(version, 0) + 1
WHERE status = 'PENDING'
  AND UPPER(TRIM(process_type)) IN ('RETIREMENT', 'WORK_ORDER', 'COMPENSATION', 'DISPOSAL')
  AND NOT EXISTS (
      SELECT 1
      FROM approval_node_assignment current_assignment
      WHERE current_assignment.tenant_id = approval_process.tenant_id
        AND current_assignment.process_id = approval_process.id
        AND current_assignment.step_no = approval_process.current_step
        AND current_assignment.status = 'PENDING'
        AND EXISTS (
            SELECT 1
            FROM workflow_definition_version definition_version
            WHERE definition_version.tenant_id = current_assignment.tenant_id
              AND definition_version.definition_id = current_assignment.workflow_definition_id
              AND definition_version.version = current_assignment.workflow_version
              AND definition_version.status = 'PUBLISHED'
        )
  );

UPDATE work_order wo
INNER JOIN approval_process p ON p.tenant_id = wo.tenant_id
    AND UPPER(TRIM(p.process_type)) = 'WORK_ORDER'
    AND p.business_id = wo.id
SET wo.status = 'CANCELLED_REQUIRES_RESUBMISSION',
    wo.version = COALESCE(wo.version, 0) + 1
WHERE p.status = 'CANCELLED_REQUIRES_RESUBMISSION'
  AND p.cancellation_reason = 'MISSING_TRUSTED_CURRENT_ASSIGNMENT'
  AND wo.status = 'PENDING';

UPDATE retirement_application ra
INNER JOIN approval_process p ON p.tenant_id = ra.tenant_id
    AND UPPER(TRIM(p.process_type)) = 'RETIREMENT'
    AND p.business_id = ra.id
SET ra.status = 'CANCELLED_REQUIRES_RESUBMISSION',
    ra.version = COALESCE(ra.version, 0) + 1
WHERE p.status = 'CANCELLED_REQUIRES_RESUBMISSION'
  AND p.cancellation_reason = 'MISSING_TRUSTED_CURRENT_ASSIGNMENT'
  AND ra.status IN ('PENDING', 'APPROVING');

UPDATE asset_compensation ac
INNER JOIN approval_process p ON p.tenant_id = ac.tenant_id
    AND UPPER(TRIM(p.process_type)) = 'COMPENSATION'
    AND p.business_id = ac.id
SET ac.status = 'CANCELLED_REQUIRES_RESUBMISSION',
    ac.version = COALESCE(ac.version, 0) + 1
WHERE p.status = 'CANCELLED_REQUIRES_RESUBMISSION'
  AND p.cancellation_reason = 'MISSING_TRUSTED_CURRENT_ASSIGNMENT'
  AND ac.status = 'PENDING';

UPDATE disposal_application da
INNER JOIN approval_process p ON p.tenant_id = da.tenant_id
    AND UPPER(TRIM(p.process_type)) = 'DISPOSAL'
    AND p.business_id = da.id
SET da.status = 'CANCELLED_REQUIRES_RESUBMISSION',
    da.version = COALESCE(da.version, 0) + 1
WHERE p.status = 'CANCELLED_REQUIRES_RESUBMISSION'
  AND p.cancellation_reason = 'MISSING_TRUSTED_CURRENT_ASSIGNMENT'
  AND da.status = 'PENDING';

UPDATE approval_node_assignment ana
INNER JOIN approval_process p ON p.tenant_id = ana.tenant_id
    AND p.id = ana.process_id
SET ana.status = 'CANCELLED'
WHERE ana.status = 'PENDING'
  AND p.status = 'CANCELLED_REQUIRES_RESUBMISSION'
  AND p.cancellation_reason = 'MISSING_TRUSTED_CURRENT_ASSIGNMENT';
