package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.Contract;
import com.ams.mapper.ContractMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContractServiceTest {

    @Mock
    private ContractMapper contractMapper;

    @Mock
    private NotificationService notificationService;

    private ContractService contractService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("dept:1");
        contractService = new ContractService(contractMapper, notificationService);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void createShouldAssignCurrentTenantBeforeInsert() {
        Contract contract = new Contract();
        contract.setContractNo("HT-2026-001");

        when(contractMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);

        contractService.create(contract);

        ArgumentCaptor<Contract> captor = ArgumentCaptor.forClass(Contract.class);
        verify(contractMapper).insert(captor.capture());
        assertThat(captor.getValue().getTenantId()).isEqualTo("dept:1");
        assertThat(captor.getValue().getStatus()).isEqualTo("DRAFT");
    }

    @Test
    void getExpiringShouldQueryOnlyCurrentTenant() {
        Contract contract = new Contract();
        contract.setId(9L);
        when(contractMapper.findExpiring(eq("dept:1"), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(contract));

        List<Contract> result = contractService.getExpiring(45);

        assertThat(result).containsExactly(contract);
        verify(contractMapper).findExpiring(eq("dept:1"), any(LocalDate.class), any(LocalDate.class));
    }

    @Test
    void getByIdShouldUseTenantScopedLookup() {
        Contract contract = new Contract();
        contract.setId(10L);
        contract.setTenantId("dept:1");
        when(contractMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(contract);

        Contract result = contractService.getById(10L);

        assertThat(result).isSameAs(contract);
        verify(contractMapper).selectOne(any(LambdaQueryWrapper.class));
    }

    @Test
    void createShouldRejectMissingTenantContext() {
        TenantContext.clear();

        assertThrows(AccessDeniedException.class, () -> contractService.create(new Contract()));
    }
}
