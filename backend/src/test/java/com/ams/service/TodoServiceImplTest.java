package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.dto.TodoCreateRequest;
import com.ams.dto.TodoResponse;
import com.ams.entity.SysTodo;
import com.ams.mapper.TodoMapper;
import com.ams.service.impl.TodoServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TodoServiceImplTest {

    private static final String TENANT_ID = "tenant-a";

    @Mock
    private TodoMapper todoMapper;

    @InjectMocks
    private TodoServiceImpl todoService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(TENANT_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void createTodoShouldPersistTenantScopedPendingTodo() {
        when(todoMapper.insert(any(SysTodo.class))).thenAnswer(invocation -> {
            SysTodo todo = invocation.getArgument(0);
            todo.setId(99L);
            return 1;
        });

        TodoCreateRequest request = new TodoCreateRequest();
        request.setUserId(7L);
        request.setTitle("  审批待办  ");
        request.setContent("请处理");
        request.setRefType("APPROVAL_PROCESS");
        request.setRefId("1001");
        request.setDueAt(LocalDateTime.now().plusDays(1));

        Long id = todoService.createTodo(request);

        assertThat(id).isEqualTo(99L);
        ArgumentCaptor<SysTodo> captor = ArgumentCaptor.forClass(SysTodo.class);
        verify(todoMapper).insert(captor.capture());
        SysTodo saved = captor.getValue();
        assertThat(saved.getTenantId()).isEqualTo(TENANT_ID);
        assertThat(saved.getUserId()).isEqualTo(7L);
        assertThat(saved.getTitle()).isEqualTo("审批待办");
        assertThat(saved.getStatus()).isEqualTo("PENDING");
        assertThat(saved.getPriority()).isEqualTo("MEDIUM");
        assertThat(saved.getCreatedAt()).isNotNull();
    }

    @Test
    void listTodosShouldMapEntityPageToResponsePage() {
        SysTodo todo = new SysTodo();
        todo.setId(11L);
        todo.setUserId(7L);
        todo.setTitle("审批待办");
        todo.setStatus("READ");
        todo.setTenantId(TENANT_ID);
        todo.setCreatedAt(LocalDateTime.now());

        Page<SysTodo> entityPage = new Page<>(1, 10, 1);
        entityPage.setRecords(List.of(todo));
        when(todoMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class))).thenReturn(entityPage);

        Page<TodoResponse> result = todoService.listTodos(7L, "READ", 1, 10);

        assertThat(result.getTotal()).isEqualTo(1);
        assertThat(result.getRecords()).hasSize(1);
        assertThat(result.getRecords().get(0).getId()).isEqualTo(11L);
        assertThat(result.getRecords().get(0).getTitle()).isEqualTo("审批待办");
        assertThat(result.getRecords().get(0).getStatus()).isEqualTo("READ");
    }

    @Test
    void markCompleteShouldCompleteTenantOwnedTodo() {
        SysTodo todo = new SysTodo();
        todo.setId(11L);
        todo.setUserId(7L);
        todo.setTenantId(TENANT_ID);
        todo.setStatus("PENDING");
        when(todoMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(todo);

        todoService.markComplete(11L, 7L);

        ArgumentCaptor<SysTodo> captor = ArgumentCaptor.forClass(SysTodo.class);
        verify(todoMapper).updateById(captor.capture());
        SysTodo updated = captor.getValue();
        assertThat(updated.getStatus()).isEqualTo("COMPLETED");
        assertThat(updated.getReadAt()).isNotNull();
        assertThat(updated.getCompletedAt()).isNotNull();
    }

    @Test
    void completeByRefShouldUpdateOpenTodosInCurrentTenant() {
        todoService.completeByRef("APPROVAL_PROCESS", "1001");

        ArgumentCaptor<SysTodo> captor = ArgumentCaptor.forClass(SysTodo.class);
        verify(todoMapper).update(captor.capture(), any(LambdaUpdateWrapper.class));
        SysTodo update = captor.getValue();
        assertThat(update.getStatus()).isEqualTo("COMPLETED");
        assertThat(update.getCompletedAt()).isNotNull();
    }
}
