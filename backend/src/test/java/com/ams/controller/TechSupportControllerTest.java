package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.SupportTicketDTO;
import com.ams.service.TechSupportService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class TechSupportControllerTest {

    @Mock
    private TechSupportService techSupportService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new TechSupportController(techSupportService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listShouldReturnTickets() throws Exception {
        SupportTicketDTO.PageResult page = new SupportTicketDTO.PageResult();
        page.setTotal(1);
        SupportTicketDTO ticket = new SupportTicketDTO();
        ticket.setId(1L);
        ticket.setTitle("系统报错");
        ticket.setPriority("URGENT");
        ticket.setPriorityLabel("紧急");
        ticket.setStatus("OPEN");
        ticket.setStatusLabel("待处理");
        ticket.setDiagnosticPackageAttached(true);
        ticket.setDiagnosticPackageMasked(true);
        page.setRecords(List.of(ticket));
        when(techSupportService.list(null, null, null, 1, 20)).thenReturn(page);

        mockMvc.perform(get("/system/tech-support"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.records[0].title").value("系统报错"))
                .andExpect(jsonPath("$.data.records[0].priorityLabel").value("紧急"))
                .andExpect(jsonPath("$.data.records[0].diagnosticPackageMasked").value(true));
    }

    @Test
    void detailShouldReturnTicketById() throws Exception {
        SupportTicketDTO ticket = new SupportTicketDTO();
        ticket.setId(5L);
        ticket.setTitle("导入失败");
        ticket.setStatus("RESOLVED");
        when(techSupportService.detail(5L)).thenReturn(ticket);

        mockMvc.perform(get("/system/tech-support/5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(5))
                .andExpect(jsonPath("$.data.status").value("RESOLVED"));
    }

    @Test
    void metaShouldReturnReadOnlyNotice() throws Exception {
        SupportTicketDTO.Meta meta = new SupportTicketDTO.Meta();
        meta.setPriorities(List.of("URGENT"));
        meta.setReadOnlyNotice("诊断包必须脱敏");
        when(techSupportService.meta()).thenReturn(meta);

        mockMvc.perform(get("/system/tech-support/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.priorities[0]").value("URGENT"))
                .andExpect(jsonPath("$.data.readOnlyNotice").value("诊断包必须脱敏"));
    }
}
