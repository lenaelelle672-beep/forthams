package com.ams.controller;

import com.ams.common.exception.BusinessException;
import com.ams.dto.CompensationCreateDTO;
import com.ams.service.CompensationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class CompensationControllerTest {

    @Mock
    private CompensationService compensationService;

    @Test
    void shouldRejectDirectCompensationCreationAndRequireApprovalProcess() {
        CompensationController controller = new CompensationController(compensationService);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> controller.create(new CompensationCreateDTO()));

        assertEquals("资产赔偿必须通过审批流程提交", exception.getMessage());
        verifyNoInteractions(compensationService);
    }

    @Test
    void shouldRejectDirectCompensationStatusChangeAndRequireApprovalProcess() {
        CompensationController controller = new CompensationController(compensationService);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> controller.updateStatus(7L, Map.of("status", "APPROVED")));

        assertEquals("赔偿状态必须由审批流程回写", exception.getMessage());
        verifyNoInteractions(compensationService);
    }
}
