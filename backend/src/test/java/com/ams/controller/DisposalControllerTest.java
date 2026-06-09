package com.ams.controller;

import com.ams.common.exception.BusinessException;
import com.ams.dto.AssetClearanceDTO;
import com.ams.dto.AssetScrapDTO;
import com.ams.dto.AssetTransferDTO;
import com.ams.service.DisposalService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class DisposalControllerTest {

    @Mock
    private DisposalService disposalService;

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
