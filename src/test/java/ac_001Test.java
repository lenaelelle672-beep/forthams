import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.*;

import java.time.LocalDate;
import java.util.List;

class AssetTransferServiceTest {

    private final AssetTransferService transferService = new AssetTransferService();

    // ==================== AC-001 ====================

    @Test
    @DisplayName("AC-001: 发起资产调拨申请成功")
    void testAc001_createTransferRequest_success() {
        TransferRequestDTO request = new TransferRequestDTO(
            List.of("asset-001", "asset-002"),
            "location-A",
            "location-B",
            "部门调整",
            LocalDate.of(2025, 2, 1)
        );

        TransferOrder order = transferService.createTransferRequest(request);

        assertNotNull(order.getId());
        assertEquals("PENDING", order.getStatus());
        assertEquals(2, order.getAssetIds().size());
        assertTrue(order.getAssetIds().contains("asset-001"));
        assertTrue(order.getAssetIds().contains("asset-002"));
    }

    @Test
    @DisplayName("AC-001: 审批通过后资产位置自动变更到目标位置")
    void testAc001_approveTransfer_autoChangeLocation() {
        TransferOrder order = transferService.createTransferRequest(new TransferRequestDTO(
            List.of("asset-001"),
            "location-A",
            "location-B",
            "部门调整",
            LocalDate.of(2025, 2, 1)
        ));

        TransferOrder approved = transferService.approveTransfer(order.getId(), "admin-user");

        assertEquals("APPROVED", approved.getStatus());
        Asset asset = transferService.getAsset("asset-001");
        assertEquals("location-B", asset.getCurrentLocation());
    }

    @Test
    @DisplayName("AC-001: 审批通过后记录完整转移轨迹包含源位置和目标位置")
    void testAc001_approveTransfer_recordsCompleteTransferHistory() {
        TransferOrder order = transferService.createTransferRequest(new TransferRequestDTO(
            List.of("asset-001"),
            "location-A",
            "location-B",
            "部门调整",
            LocalDate.of(2025, 2, 1)
        ));

        transferService.approveTransfer(order.getId(), "admin-user");

        List<TransferHistory> history = transferService.getTransferHistory("asset-001");
        assertFalse(history.isEmpty());

        TransferHistory latest = history.get(history.size() - 1);
        assertEquals("asset-001", latest.getAssetId());
        assertEquals("location-A", latest.getFromLocation());
        assertEquals("location-B", latest.getToLocation());
        assertNotNull(latest.getTransferTime());
        assertEquals("admin-user", latest.getApprovedBy());
    }

    // ==================== AC-002 ====================

    @Test
    @DisplayName("AC-002: 创建转移申请需包含资产ID列表、源位置、目标位置、调拨原因、期望转移日期")
    void testAc002_createTransferRequest_allFieldsPersisted() {
        TransferRequestDTO request = new TransferRequestDTO(
            List.of("asset-001", "asset-003"),
            "building-1-floor-2",
            "building-3-floor-1",
            "部门搬迁重组",
            LocalDate.of(2025, 2, 15)
        );

        TransferOrder order = transferService.createTransferRequest(request);

        assertNotNull(order.getId());
        assertEquals(List.of("asset-001", "asset-003"), order.getAssetIds());
        assertEquals("building-1-floor-2", order.getFromLocation());
        assertEquals("building-3-floor-1", order.getToLocation());
        assertEquals("部门搬迁重组", order.getReason());
        assertEquals(LocalDate.of(2025, 2, 15), order.getExpectedDate());
    }

    @Test
    @DisplayName("AC-002: 在用状态的资产可调拨")
    void testAc002_activeAsset_canTransfer() {
        TransferRequestDTO request = new TransferRequestDTO(
            List.of("asset-active-001"),
            "location-A",
            "location-B",
            "业务需要",
            LocalDate.of(2025, 3, 1)
        );

        TransferOrder order = transferService.createTransferRequest(request);

        assertNotNull(order);
        assertEquals("PENDING", order.getStatus());
    }

    @Test
    @DisplayName("AC-002: 闲置状态的资产可调拨")
    void testAc002_idleAsset_canTransfer() {
        TransferRequestDTO request = new TransferRequestDTO(
            List.of("asset-idle-001"),
            "location-A",
            "location-B",
            "重新分配",
            LocalDate.of(2025, 3, 1)
        );

        TransferOrder order = transferService.createTransferRequest(request);

        assertNotNull(order);
        assertEquals("PENDING", order.getStatus());
    }

    @Test
    @DisplayName("AC-002: 报废状态的资产不可调拨应抛出异常")
    void testAc002_retiredAsset_cannotTransfer() {
        TransferRequestDTO request = new TransferRequestDTO(
            List.of("asset-retired-001"),
            "location-A",
            "location-B",
            "尝试调拨",
            LocalDate.of(2025, 3, 1)
        );

        assertThrows(AssetNotTransferableException.class,
            () -> transferService.createTransferRequest(request));
    }

    @Test
    @DisplayName("AC-002: 维修中状态的资产不可调拨应抛出异常")
    void testAc002_repairingAsset_cannotTransfer() {
        TransferRequestDTO request = new TransferRequestDTO(
            List.of("asset-repairing-001"),
            "location-A",
            "location-B",
            "尝试调拨",
            LocalDate.of(2025, 3, 1)
        );

        assertThrows(AssetNotTransferableException.class,
            () -> transferService.createTransferRequest(request));
    }

    @Test
    @DisplayName("AC-002: 混合状态资产列表中有不可调拨资产时整体创建失败")
    void testAc002_mixedAssets_withNonTransferable_fails() {
        TransferRequestDTO request = new TransferRequestDTO(
            List.of("asset-active-001", "asset-retired-001"),
            "location-A",
            "location-B",
            "批量调拨",
            LocalDate.of(2025, 3, 1)
        );

        assertThrows(AssetNotTransferableException.class,
            () -> transferService.createTransferRequest(request));
    }
}

class AssetTransferControllerTest {

    private final AssetTransferController controller = new AssetTransferController();

    @Test
    @DisplayName("AC-002: Controller创建资产转移申请接口返回201状态码")
    void testAc002_controllerCreate_returnsCreatedStatus() {
        TransferRequestDTO request = new TransferRequestDTO(
            List.of("asset-active-001"),
            "location-A",
            "location-B",
            "业务调整",
            LocalDate.of(2025, 3, 1)
        );

        var response = controller.createTransfer(request);

        assertEquals(201, response.getStatusCodeValue());
        assertNotNull(response.getBody());
        assertEquals("PENDING", response.getBody().getStatus());
    }

    @Test
    @DisplayName("AC-002: Controller校验不通过时返回400状态码")
    void testAc002_controllerCreate_invalidAsset_returnsBadRequest() {
        TransferRequestDTO request = new TransferRequestDTO(
            List.of("asset-retired-001"),
            "location-A",
            "location-B",
            "业务调整",
            LocalDate.of(2025, 3, 1)
        );

        var response = controller.createTransfer(request);

        assertEquals(400, response.getStatusCodeValue());
    }
}

class ModuleImportTest {

    @Test
    @DisplayName("AC-005: AssetTransferController类可正常加载不抛出异常")
    void testAc005_assetTransferController_importable() {
        assertDoesNotThrow(() ->
            Class.forName("com.swarm.controller.AssetTransferController")
        );
    }

    @Test
    @DisplayName("AC-005: AssetTransferService类可正常加载不抛出异常")
    void testAc005_assetTransferService_importable() {
        assertDoesNotThrow(() ->
            Class.forName("com.swarm.service.AssetTransferService")
        );
    }

    @Test
    @DisplayName("AC-005: TransferOrder实体类可正常加载不抛出异常")
    void testAc005_transferOrder_importable() {
        assertDoesNotThrow(() ->
            Class.forName("com.swarm.entity.TransferOrder")
        );
    }

    @Test
    @DisplayName("AC-005: TransferRequestDTO可正常加载不抛出异常")
    void testAc005_transferRequestDTO_importable() {
        assertDoesNotThrow(() ->
            Class.forName("com.swarm.dto.TransferRequestDTO")
        );
    }

    @Test
    @DisplayName("AC-005: AssetNotTransferableException可正常加载不抛出异常")
    void testAc005_exception_importable() {
        assertDoesNotThrow(() ->
            Class.forName("com.swarm.exception.AssetNotTransferableException")
        );
    }
}