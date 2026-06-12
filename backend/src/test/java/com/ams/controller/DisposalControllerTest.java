package com.ams.controller;

import com.ams.common.exception.BusinessException;
import com.ams.dto.AssetClearanceDTO;
import com.ams.dto.AssetScrapDTO;
import com.ams.dto.AssetTransferDTO;
import com.ams.entity.AssetChangeLog;
import com.ams.service.DisposalService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DisposalControllerTest {

    @Mock
    private DisposalService disposalService;

    @Test
    void shouldListDisposalsFromRootEndpoint() {
        DisposalController controller = new DisposalController(disposalService);
        Page<AssetChangeLog> page = new Page<>(1, 10);
        when(disposalService.getDisposalHistory(1, 10, "TRANSFER")).thenReturn(page);

        assertSame(page, controller.list(1, 10, "TRANSFER").getData());
        verify(disposalService).getDisposalHistory(1, 10, "TRANSFER");
    }

    @Test
    void shouldReturnStatsFromRootStatsEndpoint() {
        DisposalController controller = new DisposalController(disposalService);
        Page<AssetChangeLog> page = new Page<>(1, 1);
        page.setTotal(3);
        when(disposalService.getDisposalHistory(1, 1, null)).thenReturn(page);

        assertEquals(3L, controller.stats().getData().get("totalThisMonth"));
        verify(disposalService).getDisposalHistory(1, 1, null);
    }

    @Test
    void shouldRejectDirectTransferAndRequireApprovalProcess() {
        DisposalController controller = new DisposalController(disposalService);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> controller.transfer(new AssetTransferDTO()));

        assertEquals("资产转移必须通过审批流程提交", exception.getMessage());
        verifyNoInteractions(disposalService);
    }

    @Test
    void shouldRejectDirectClearanceAndRequireApprovalProcess() {
        DisposalController controller = new DisposalController(disposalService);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> controller.clearance(new AssetClearanceDTO()));

        assertEquals("资产清退必须通过审批流程提交", exception.getMessage());
        verifyNoInteractions(disposalService);
    }

    @Test
    void shouldRejectDirectScrapAndRequireApprovalProcess() {
        DisposalController controller = new DisposalController(disposalService);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> controller.scrap(new AssetScrapDTO()));

        assertEquals("资产报废必须通过审批流程提交", exception.getMessage());
        verifyNoInteractions(disposalService);
    }
}
