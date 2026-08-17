package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.InventoryScanDTO;
import com.ams.dto.InventoryTaskCreateDTO;
import com.ams.entity.Asset;
import com.ams.entity.Dept;
import com.ams.entity.InventoryDetail;
import com.ams.entity.InventoryTask;
import com.ams.entity.User;
import com.ams.enums.InventoryScanStatus;
import com.ams.enums.InventoryStatus;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.InventoryDetailMapper;
import com.ams.mapper.InventoryTaskMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.ams.security.TenantSecurityAudit;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private static final Logger log = LoggerFactory.getLogger(InventoryService.class);
    private static final int MAX_PAGE_SIZE = 100;
    private static final int DEFAULT_DETAIL_PAGE_SIZE = 50;
    private static final String INVENTORY_QUERY_PERMISSION = "inventory:query";
    private static final String INVENTORY_CREATE_PERMISSION = "inventory:create";
    private static final String INVENTORY_UPDATE_PERMISSION = "inventory:update";
    private static final String INVENTORY_SCAN_PERMISSION = "inventory:scan";

    private final InventoryTaskMapper inventoryTaskMapper;
    private final InventoryDetailMapper inventoryDetailMapper;
    private final AssetMapper assetMapper;
    private final DeptMapper deptMapper;
    private final UserMapper userMapper;
    private final UserTenantMembershipMapper userTenantMembershipMapper;
    private final TenantAuthorityService tenantAuthorityService;
    private final AssetDataPermissionEvaluator assetDataPermissionEvaluator;

    public Page<InventoryTask> queryTasks(Integer page, Integer pageSize, String status) {
        TenantContext.requireTenantId();
        requirePermission(INVENTORY_QUERY_PERMISSION);
        int normalizedPage = normalizePage(page);
        int normalizedPageSize = normalizePageSize(pageSize);

        LambdaQueryWrapper<InventoryTask> wrapper = new LambdaQueryWrapper<>();
        if (status != null && !status.isEmpty()) {
            wrapper.eq(InventoryTask::getStatus, parseTaskStatus(status).name());
        }
        assetDataPermissionEvaluator.applyToInventoryTaskScope(wrapper);
        wrapper.orderByDesc(InventoryTask::getCreateTime).orderByDesc(InventoryTask::getId);
        Page<InventoryTask> taskPage = inventoryTaskMapper.selectPage(new Page<>(normalizedPage, normalizedPageSize), wrapper);
        projectTaskDepartmentMetadata(taskPage.getRecords());
        return taskPage;
    }

    public Map<String, Object> getTaskById(Long id) {
        TenantContext.requireTenantId();
        requirePermission(INVENTORY_QUERY_PERMISSION);
        InventoryTask task = getTaskEntityById(id);
        projectTaskDepartmentMetadata(task);
        Page<InventoryDetail> details = getTaskDetailsForTask(task, 1, DEFAULT_DETAIL_PAGE_SIZE);

        Map<String, Object> result = new HashMap<>();
        result.put("task", task);
        result.put("details", details);
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryTask createTask(InventoryTaskCreateDTO createDTO) {
        String tenantId = TenantContext.requireTenantId();
        requirePermission(INVENTORY_CREATE_PERMISSION);
        if (createDTO == null) {
            throw new BusinessException("盘点任务请求不能为空");
        }
        validateDateRange(createDTO);
        User currentUser = tenantAuthorityService.requireCurrentTenantMember();
        Set<Long> departmentIds = resolveTaskDepartmentScope(createDTO, tenantId);
        long totalAssets = countAssetsInDepartments(tenantId, departmentIds);
        if (totalAssets <= 0) {
            throw new BusinessException("盘点范围内不存在可访问资产");
        }
        if (totalAssets > Integer.MAX_VALUE) {
            throw new BusinessException("盘点范围资产数量超出系统上限");
        }
        User executor = resolveActiveTenantExecutor(createDTO.getExecutorId(), currentUser, tenantId);

        InventoryTask task = new InventoryTask();
        task.setTenantId(tenantId);
        task.setTaskName(normalizeTaskName(createDTO.getTaskName()));
        task.setInventoryType(normalizeInventoryType(createDTO.getInventoryType()));
        task.setDeptIds(joinDepartmentIds(departmentIds));
        task.setStartDate(createDTO.getStartDate());
        task.setEndDate(createDTO.getEndDate());
        task.setExecutorId(executor.getId());
        task.setCreateBy(currentUser.getId());
        task.setTaskNo(generateTaskNo());
        task.setStatus(InventoryStatus.DRAFT.name());
        task.setTotalCount((int) totalAssets);
        task.setScannedCount(0);
        task.setMatchCount(0);
        task.setLossCount((int) totalAssets);

        if (inventoryTaskMapper.insert(task) != 1) {
            throw new BusinessException("盘点任务创建失败");
        }
        try {
            int snapshotCount = inventoryDetailMapper.insertTaskAssetSnapshot(task.getId(), tenantId, departmentIds);
            if (snapshotCount != totalAssets) {
                throw new BusinessException("盘点任务资产快照不完整，创建已取消");
            }
        } catch (DuplicateKeyException exception) {
            throw new BusinessException("盘点任务资产快照存在重复关联，创建已取消");
        }
        return task;
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryTask updateTaskStatus(Long id, String status) {
        String tenantId = TenantContext.requireTenantId();
        requirePermission(INVENTORY_UPDATE_PERMISSION);
        User currentUser = tenantAuthorityService.requireCurrentTenantMember();
        InventoryTask task = getTaskEntityForUpdate(id);
        requireTaskExecutor(task, currentUser);

        InventoryStatus currentStatus = parseTaskStatus(task.getStatus());
        InventoryStatus targetStatus = parseTaskStatus(status);
        if (!currentStatus.canTransitionTo(targetStatus)) {
            throw new BusinessException("盘点任务状态流转不合法");
        }
        if (targetStatus == InventoryStatus.COMPLETED) {
            ensureAllScopedAssetsScanned(task, tenantId);
        }

        task.setStatus(targetStatus.name());
        int updated = inventoryTaskMapper.update(task, new LambdaUpdateWrapper<InventoryTask>()
                .eq(InventoryTask::getId, task.getId())
                .eq(InventoryTask::getTenantId, tenantId)
                .eq(InventoryTask::getStatus, currentStatus.name()));
        if (updated != 1) {
            throw new BusinessException("盘点任务状态已变更，请刷新后重试");
        }
        return task;
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryDetail addScanResult(Long taskId, InventoryScanDTO scanDTO) {
        String tenantId = TenantContext.requireTenantId();
        requirePermission(INVENTORY_SCAN_PERMISSION);
        if (scanDTO == null || scanDTO.getAssetId() == null || scanDTO.getAssetId() <= 0) {
            throw new BusinessException("盘点扫描必须关联有效资产");
        }
        User currentUser = tenantAuthorityService.requireCurrentTenantMember();
        InventoryTask task = getTaskEntityForUpdate(taskId);
        requireTaskExecutor(task, currentUser);
        if (parseTaskStatus(task.getStatus()) != InventoryStatus.IN_PROGRESS) {
            throw new BusinessException("仅进行中的盘点任务可以扫描资产");
        }

        Asset asset = loadAccessibleAsset(scanDTO.getAssetId(), tenantId);
        validateRfidTag(scanDTO.getRfidTag(), asset.getRfidTag());
        InventoryScanStatus scanStatus = parseScanStatus(scanDTO.getStatus());
        InventoryDetail detail = inventoryDetailMapper.selectOne(new LambdaQueryWrapper<InventoryDetail>()
                .eq(InventoryDetail::getTenantId, tenantId)
                .eq(InventoryDetail::getTaskId, taskId)
                .eq(InventoryDetail::getAssetId, asset.getId())
                .last("FOR UPDATE"));
        if (detail == null) {
            throw new BusinessException("资产不在盘点任务范围内");
        }
        if (detail.getScanTime() != null) {
            throw new BusinessException("同一资产不能重复扫描");
        }

        LocalDateTime scanTime = LocalDateTime.now();
        int detailUpdated = inventoryDetailMapper.update(null, new LambdaUpdateWrapper<InventoryDetail>()
                .set(InventoryDetail::getRfidTag, asset.getRfidTag())
                .set(InventoryDetail::getStatus, scanStatus.name())
                .set(InventoryDetail::getExpectedLocation, asset.getLocation())
                .set(InventoryDetail::getActualLocation, trimToNull(scanDTO.getActualLocation()))
                .set(InventoryDetail::getScanTime, scanTime)
                .set(InventoryDetail::getRemark, trimToNull(scanDTO.getRemark()))
                .eq(InventoryDetail::getId, detail.getId())
                .eq(InventoryDetail::getTenantId, tenantId)
                .isNull(InventoryDetail::getScanTime));
        if (detailUpdated != 1) {
            throw new BusinessException("同一资产不能重复扫描或扫描状态已变更");
        }
        detail.setRfidTag(asset.getRfidTag());
        detail.setStatus(scanStatus.name());
        detail.setExpectedLocation(asset.getLocation());
        detail.setActualLocation(trimToNull(scanDTO.getActualLocation()));
        detail.setScanTime(scanTime);
        detail.setRemark(trimToNull(scanDTO.getRemark()));

        int scannedCount = countScannedDetails(taskId, tenantId, null);
        int matchCount = countScannedDetails(taskId, tenantId, InventoryScanStatus.MATCH);

        int totalCount = task.getTotalCount() == null ? 0 : task.getTotalCount();
        int lossCount = Math.max(totalCount - scannedCount, 0);

        task.setScannedCount(scannedCount);
        task.setMatchCount(matchCount);
        task.setLossCount(lossCount);
        int updated = inventoryTaskMapper.update(task, new LambdaUpdateWrapper<InventoryTask>()
                .eq(InventoryTask::getId, task.getId())
                .eq(InventoryTask::getTenantId, tenantId)
                .eq(InventoryTask::getStatus, InventoryStatus.IN_PROGRESS.name()));
        if (updated != 1) {
            throw new BusinessException("盘点任务状态已变更，请刷新后重试");
        }

        return detail;
    }

    public Page<InventoryDetail> getTaskDetails(Long taskId, Integer page, Integer pageSize) {
        TenantContext.requireTenantId();
        requirePermission(INVENTORY_QUERY_PERMISSION);
        InventoryTask task = getTaskEntityById(taskId);
        return getTaskDetailsForTask(task, normalizePage(page), normalizePageSize(pageSize));
    }

    private Page<InventoryDetail> getTaskDetailsForTask(InventoryTask task, int page, int pageSize) {
        String tenantId = TenantContext.requireTenantId();
        LambdaQueryWrapper<InventoryDetail> detailQuery = new LambdaQueryWrapper<InventoryDetail>()
                .eq(InventoryDetail::getTenantId, tenantId)
                .eq(InventoryDetail::getTaskId, task.getId())
                .orderByDesc(InventoryDetail::getScanTime)
                .orderByDesc(InventoryDetail::getCreateTime)
                .orderByDesc(InventoryDetail::getId);
        assetDataPermissionEvaluator.applyToInventoryTaskDetails(detailQuery);
        return inventoryDetailMapper.selectPage(new Page<>(page, pageSize), detailQuery);
    }

    private InventoryTask getTaskEntityById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        if (id == null || id <= 0) {
            throw new BusinessException("盘点任务不存在");
        }
        LambdaQueryWrapper<InventoryTask> taskQuery = new LambdaQueryWrapper<InventoryTask>()
                .eq(InventoryTask::getId, id)
                .eq(InventoryTask::getTenantId, tenantId)
                .last("LIMIT 1");
        assetDataPermissionEvaluator.applyToInventoryTaskScope(taskQuery);
        InventoryTask task = inventoryTaskMapper.selectOne(taskQuery);
        if (task == null) {
            // inventory:query 读取路径不得用响应差异暴露跨租户、范围外或不存在任务的存在性。
            throw new BusinessException("盘点任务不存在");
        }
        return task;
    }

    private InventoryTask getTaskEntityForUpdate(Long id) {
        String tenantId = TenantContext.requireTenantId();
        if (id == null || id <= 0) {
            throw new BusinessException("盘点任务不存在");
        }
        LambdaQueryWrapper<InventoryTask> taskQuery = new LambdaQueryWrapper<InventoryTask>()
                .eq(InventoryTask::getId, id)
                .eq(InventoryTask::getTenantId, tenantId)
                .last("FOR UPDATE");
        assetDataPermissionEvaluator.applyToInventoryTaskScope(taskQuery);
        InventoryTask task = inventoryTaskMapper.selectOne(taskQuery);
        if (task == null) {
            throwTaskMutationLookupFailure(id, tenantId);
        }
        return task;
    }

    private void throwTaskMutationLookupFailure(Long id, String tenantId) {
        InventoryTask tenantTask = inventoryTaskMapper.selectOne(new LambdaQueryWrapper<InventoryTask>()
                .eq(InventoryTask::getId, id)
                .eq(InventoryTask::getTenantId, tenantId)
                .last("LIMIT 1"));
        if (tenantTask != null) {
            throw new AccessDeniedException("盘点任务包含当前用户无权访问的资产范围");
        }
        InventoryTask existingTask = inventoryTaskMapper.selectById(id);
        if (existingTask != null) {
            throw new AccessDeniedException("盘点任务不属于当前租户");
        }
        throw new BusinessException("盘点任务不存在");
    }

    private void projectTaskDepartmentMetadata(List<InventoryTask> tasks) {
        if (tasks == null || tasks.isEmpty() || assetDataPermissionEvaluator.canExposeInventoryTaskDepartmentMetadata()) {
            return;
        }
        tasks.forEach(task -> {
            if (task != null) {
                task.setDeptIds(null);
            }
        });
    }

    private void projectTaskDepartmentMetadata(InventoryTask task) {
        if (task != null && !assetDataPermissionEvaluator.canExposeInventoryTaskDepartmentMetadata()) {
            // 可见性已由真实资产快照严格判定；提交时的 deptIds 可能伪造、陈旧或超出当前数据范围。
            task.setDeptIds(null);
        }
    }

    private String generateTaskNo() {
        String dateStr = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        return "INV-" + dateStr + "-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase(Locale.ROOT);
    }

    private Set<Long> resolveTaskDepartmentScope(InventoryTaskCreateDTO createDTO, String tenantId) {
        Set<Long> departmentIds = parseDepartmentIds(createDTO.getDeptIds());
        if (departmentIds.isEmpty()) {
            throw new BusinessException("盘点任务必须指定包含资产的部门范围");
        }
        validateActiveTenantDepartments(departmentIds, tenantId);
        assertAllScopeAssetsAccessible(tenantId, departmentIds);
        return departmentIds;
    }

    private void assertAllScopeAssetsAccessible(String tenantId, Set<Long> departmentIds) {
        long totalAssets = countAssetsInDepartments(tenantId, departmentIds);
        long accessibleAssets = countScopedAssets(tenantId, departmentIds);
        if (totalAssets != accessibleAssets) {
            throw new AccessDeniedException("盘点范围包含当前用户无权访问的真实资产");
        }
    }

    private void validateActiveTenantDepartments(Set<Long> departmentIds, String tenantId) {
        List<Dept> departments = deptMapper.selectList(new LambdaQueryWrapper<Dept>()
                .eq(Dept::getTenantId, tenantId)
                .in(Dept::getId, departmentIds));
        if (departments == null || departments.size() != departmentIds.size()) {
            throw new BusinessException("盘点范围包含不存在、已删除或跨租户部门");
        }
        for (Dept department : departments) {
            if (department == null || department.getId() == null || !isEnabled(department)) {
                throw new BusinessException("盘点范围包含已停用部门");
            }
        }
    }

    private User resolveActiveTenantExecutor(Long requestedExecutorId, User currentUser, String tenantId) {
        Long executorId = requestedExecutorId == null ? currentUser.getId() : requestedExecutorId;
        if (executorId == null || executorId <= 0) {
            throw new BusinessException("盘点任务执行人无效");
        }
        User executor = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getId, executorId)
                .eq(User::getTenantId, tenantId)
                .eq(User::getStatus, 1)
                .last("LIMIT 1"));
        if (executor == null || executor.getId() == null
                || userTenantMembershipMapper.countActiveMembership(executor.getId(), tenantId) != 1) {
            throw new BusinessException("盘点任务执行人不属于当前租户或已停用");
        }
        return executor;
    }

    private void requireTaskExecutor(InventoryTask task, User currentUser) {
        if (task.getExecutorId() == null || currentUser == null || currentUser.getId() == null
                || !task.getExecutorId().equals(currentUser.getId())) {
            throw new AccessDeniedException("仅任务执行人可以变更盘点任务或提交扫描");
        }
    }

    private long countScopedAssets(String tenantId, Set<Long> departmentIds) {
        LambdaQueryWrapper<Asset> wrapper = new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId)
                .in(Asset::getDeptId, departmentIds);
        assetDataPermissionEvaluator.applyTo(wrapper);
        Long count = assetMapper.selectCount(wrapper);
        return count == null ? 0 : count;
    }

    private long countAssetsInDepartments(String tenantId, Set<Long> departmentIds) {
        Long count = assetMapper.selectCount(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId)
                .in(Asset::getDeptId, departmentIds));
        return count == null ? 0 : count;
    }

    private Asset loadAccessibleAsset(Long assetId, String tenantId) {
        Asset asset = assetMapper.selectOne(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getId, assetId)
                .eq(Asset::getTenantId, tenantId)
                .last("LIMIT 1"));
        if (asset == null) {
            Asset existingAsset = assetMapper.selectById(assetId);
            if (existingAsset == null) {
                throw new BusinessException("关联资产不存在");
            }
            TenantSecurityAudit.logCrossTenantAttempt(log, "inventoryScan", assetId, tenantId, existingAsset.getTenantId());
            throw new AccessDeniedException("关联资产不属于当前租户");
        }
        assetDataPermissionEvaluator.assertCanAccess(asset);
        return asset;
    }

    private void ensureAllScopedAssetsScanned(InventoryTask task, String tenantId) {
        int scannedCount = countScannedDetails(task.getId(), tenantId, null);
        int totalCount = task.getTotalCount() == null ? 0 : task.getTotalCount();
        if (totalCount <= 0 || scannedCount != totalCount) {
            throw new BusinessException("仅全部范围资产完成扫描后可以结束盘点");
        }
    }

    private int countScannedDetails(Long taskId, String tenantId, InventoryScanStatus status) {
        LambdaQueryWrapper<InventoryDetail> wrapper = new LambdaQueryWrapper<InventoryDetail>()
                .eq(InventoryDetail::getTenantId, tenantId)
                .eq(InventoryDetail::getTaskId, taskId)
                .isNotNull(InventoryDetail::getScanTime);
        if (status != null) {
            wrapper.eq(InventoryDetail::getStatus, status.name());
        }
        Long count = inventoryDetailMapper.selectCount(wrapper);
        if (count == null) {
            return 0;
        }
        if (count > Integer.MAX_VALUE) {
            throw new BusinessException("盘点明细数量超出系统上限");
        }
        return count.intValue();
    }

    private Set<Long> parseDepartmentIds(String rawDepartmentIds) {
        Set<Long> departmentIds = new TreeSet<>();
        if (rawDepartmentIds == null || rawDepartmentIds.isBlank()) {
            return departmentIds;
        }
        for (String rawId : rawDepartmentIds.split(",", -1)) {
            String normalizedId = rawId == null ? "" : rawId.trim();
            if (!normalizedId.matches("[1-9]\\d*")) {
                throw new BusinessException("盘点部门范围必须是逗号分隔的正整数ID");
            }
            try {
                Long departmentId = Long.valueOf(normalizedId);
                if (!departmentIds.add(departmentId)) {
                    throw new BusinessException("盘点部门范围不能包含重复部门");
                }
            } catch (NumberFormatException exception) {
                throw new BusinessException("盘点部门范围ID超出有效范围");
            }
        }
        return new LinkedHashSet<>(departmentIds);
    }

    private String joinDepartmentIds(Set<Long> departmentIds) {
        return departmentIds.stream().map(String::valueOf).reduce((left, right) -> left + "," + right)
                .orElseThrow(() -> new BusinessException("盘点任务必须指定部门范围"));
    }

    private String normalizeInventoryType(String inventoryType) {
        if (inventoryType == null || inventoryType.isBlank()) {
            throw new BusinessException("盘点类型不能为空");
        }
        String normalized = inventoryType.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("FULL", "PARTIAL", "CYCLE").contains(normalized)) {
            throw new BusinessException("盘点类型不合法");
        }
        return normalized;
    }

    private InventoryStatus parseTaskStatus(String status) {
        try {
            InventoryStatus inventoryStatus = InventoryStatus.fromName(status);
            if (inventoryStatus == null) {
                throw new IllegalArgumentException("Inventory status must not be null");
            }
            return inventoryStatus;
        } catch (IllegalArgumentException exception) {
            throw new BusinessException("盘点任务状态不合法");
        }
    }

    private InventoryScanStatus parseScanStatus(String status) {
        try {
            return InventoryScanStatus.fromName(status);
        } catch (IllegalArgumentException exception) {
            throw new BusinessException("盘点结果不合法");
        }
    }

    private void validateDateRange(InventoryTaskCreateDTO createDTO) {
        if (createDTO.getTotalCount() != null && createDTO.getTotalCount() < 0) {
            throw new BusinessException("盘点总数不能为负数");
        }
        if (createDTO.getStartDate() != null && createDTO.getEndDate() != null
                && createDTO.getEndDate().isBefore(createDTO.getStartDate())) {
            throw new BusinessException("盘点结束日期不能早于开始日期");
        }
    }

    private String normalizeTaskName(String taskName) {
        if (taskName == null || taskName.isBlank()) {
            throw new BusinessException("盘点任务名称不能为空");
        }
        String normalized = taskName.trim();
        if (normalized.length() > 256) {
            throw new BusinessException("盘点任务名称不能超过256个字符");
        }
        return normalized;
    }

    private void validateRfidTag(String providedTag, String assetTag) {
        if (providedTag == null || providedTag.isBlank()) {
            return;
        }
        if (assetTag == null || !assetTag.equals(providedTag.trim())) {
            throw new BusinessException("RFID标签与关联资产不匹配");
        }
    }

    private boolean isEnabled(Dept department) {
        return "1".equals(department.getStatus()) || "ACTIVE".equalsIgnoreCase(department.getStatus());
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private int normalizePage(Integer page) {
        return page == null || page < 1 ? 1 : page;
    }

    private int normalizePageSize(Integer pageSize) {
        if (pageSize == null || pageSize < 1) {
            return 10;
        }
        return Math.min(pageSize, MAX_PAGE_SIZE);
    }

    private void requirePermission(String permission) {
        if (!hasPermission(permission)) {
            throw new AccessDeniedException("缺少盘点权限: " + permission);
        }
    }

    private boolean hasPermission(String permission) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null
                && !(authentication instanceof AnonymousAuthenticationToken)
                && authentication.isAuthenticated()
                && authentication.getAuthorities().stream()
                .anyMatch(authority -> permission.equals(authority.getAuthority()));
    }
}
