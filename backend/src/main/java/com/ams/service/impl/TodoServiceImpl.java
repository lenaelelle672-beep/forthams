package com.ams.service.impl;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.TodoCreateRequest;
import com.ams.dto.TodoResponse;
import com.ams.entity.SysTodo;
import com.ams.mapper.TodoMapper;
import com.ams.service.TodoService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 待办服务实现
 */
@Service
@RequiredArgsConstructor
public class TodoServiceImpl implements TodoService {

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_READ = "READ";
    private static final String STATUS_COMPLETED = "COMPLETED";
    private static final String DEFAULT_PRIORITY = "MEDIUM";

    private final TodoMapper todoMapper;

    @Override
    @Transactional
    public Long createTodo(TodoCreateRequest request) {
        if (request == null) {
            throw new BusinessException("待办创建请求不能为空");
        }
        if (request.getUserId() == null) {
            throw new BusinessException("待办用户不能为空");
        }
        if (!hasText(request.getTitle())) {
            throw new BusinessException("待办标题不能为空");
        }

        String tenantId = TenantContext.requireTenantId();
        LocalDateTime now = LocalDateTime.now();
        SysTodo todo = new SysTodo();
        todo.setUserId(request.getUserId());
        todo.setTitle(request.getTitle().trim());
        todo.setContent(request.getContent());
        todo.setRefType(request.getRefType());
        todo.setRefId(request.getRefId());
        todo.setPriority(hasText(request.getPriority()) ? request.getPriority().trim() : DEFAULT_PRIORITY);
        todo.setDueAt(request.getDueAt());
        todo.setStatus(STATUS_PENDING);
        todo.setTenantId(tenantId);
        todo.setCreatedAt(now);
        todoMapper.insert(todo);
        return todo.getId();
    }

    @Override
    public Page<TodoResponse> listTodos(Long userId, String status, int page, int pageSize) {
        if (userId == null) {
            throw new BusinessException("待办用户不能为空");
        }
        String tenantId = TenantContext.requireTenantId();
        int safePage = Math.max(page, 1);
        int safePageSize = Math.max(pageSize, 1);

        Page<SysTodo> todoPage = todoMapper.selectPage(new Page<>(safePage, safePageSize),
                new LambdaQueryWrapper<SysTodo>()
                        .eq(SysTodo::getTenantId, tenantId)
                        .eq(SysTodo::getUserId, userId)
                        .eq(hasText(status), SysTodo::getStatus, status)
                        .orderByDesc(SysTodo::getCreatedAt));

        Page<TodoResponse> responsePage = new Page<>(todoPage.getCurrent(), todoPage.getSize(), todoPage.getTotal());
        List<TodoResponse> records = todoPage.getRecords() == null
                ? List.of()
                : todoPage.getRecords().stream().map(this::toResponse).collect(Collectors.toList());
        responsePage.setRecords(records);
        return responsePage;
    }

    @Override
    public long getUnreadCount(Long userId) {
        if (userId == null) {
            throw new BusinessException("待办用户不能为空");
        }
        String tenantId = TenantContext.requireTenantId();
        return todoMapper.selectCount(new LambdaQueryWrapper<SysTodo>()
                .eq(SysTodo::getTenantId, tenantId)
                .eq(SysTodo::getUserId, userId)
                .eq(SysTodo::getStatus, STATUS_PENDING));
    }

    @Override
    @Transactional
    public void markRead(Long id, Long userId) {
        SysTodo todo = findTodoForUser(id, userId);
        if (STATUS_COMPLETED.equals(todo.getStatus())) {
            return;
        }
        todo.setStatus(STATUS_READ);
        if (todo.getReadAt() == null) {
            todo.setReadAt(LocalDateTime.now());
        }
        todoMapper.updateById(todo);
    }

    @Override
    @Transactional
    public void markComplete(Long id, Long userId) {
        SysTodo todo = findTodoForUser(id, userId);
        if (STATUS_COMPLETED.equals(todo.getStatus())) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        todo.setStatus(STATUS_COMPLETED);
        if (todo.getReadAt() == null) {
            todo.setReadAt(now);
        }
        todo.setCompletedAt(now);
        todoMapper.updateById(todo);
    }

    @Override
    @Transactional
    public void reassignTodo(Long id, Long newUserId, Long currentUserId) {
        if (newUserId == null) {
            throw new BusinessException("新待办用户不能为空");
        }
        SysTodo todo = findTodoForUser(id, currentUserId);
        if (STATUS_COMPLETED.equals(todo.getStatus())) {
            throw new BusinessException("已完成待办不能转交");
        }
        todo.setUserId(newUserId);
        todo.setStatus(STATUS_PENDING);
        todo.setReadAt(null);
        todoMapper.updateById(todo);
    }

    @Override
    @Transactional
    public void completeByRef(String refType, String refId) {
        if (!hasText(refType) || !hasText(refId)) {
            return;
        }
        String tenantId = TenantContext.requireTenantId();
        SysTodo update = new SysTodo();
        update.setStatus(STATUS_COMPLETED);
        update.setCompletedAt(LocalDateTime.now());
        todoMapper.update(update, new LambdaUpdateWrapper<SysTodo>()
                .eq(SysTodo::getTenantId, tenantId)
                .eq(SysTodo::getRefType, refType)
                .eq(SysTodo::getRefId, refId)
                .ne(SysTodo::getStatus, STATUS_COMPLETED));
    }

    private SysTodo findTodoForUser(Long id, Long userId) {
        if (id == null) {
            throw new BusinessException("待办ID不能为空");
        }
        if (userId == null) {
            throw new BusinessException("待办用户不能为空");
        }
        String tenantId = TenantContext.requireTenantId();
        SysTodo todo = todoMapper.selectOne(new LambdaQueryWrapper<SysTodo>()
                .eq(SysTodo::getId, id)
                .eq(SysTodo::getUserId, userId)
                .eq(SysTodo::getTenantId, tenantId)
                .last("LIMIT 1"));
        if (todo == null) {
            throw new BusinessException("待办不存在或无权操作");
        }
        return todo;
    }

    private TodoResponse toResponse(SysTodo todo) {
        TodoResponse response = new TodoResponse();
        response.setId(todo.getId());
        response.setUserId(todo.getUserId());
        response.setTitle(todo.getTitle());
        response.setContent(todo.getContent());
        response.setRefType(todo.getRefType());
        response.setRefId(todo.getRefId());
        response.setPriority(todo.getPriority());
        response.setDueAt(todo.getDueAt());
        response.setStatus(todo.getStatus());
        response.setCreatedAt(todo.getCreatedAt());
        response.setReadAt(todo.getReadAt());
        response.setCompletedAt(todo.getCompletedAt());
        return response;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
