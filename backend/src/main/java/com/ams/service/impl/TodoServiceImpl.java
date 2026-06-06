package com.ams.service.impl;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.TodoCreateRequest;
import com.ams.dto.TodoResponse;
import com.ams.entity.SysTodo;
import com.ams.mapper.TodoMapper;
import com.ams.service.TodoService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 待办服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TodoServiceImpl implements TodoService {

    private final TodoMapper todoMapper;

    @Override
    @Transactional
    public Long createTodo(TodoCreateRequest request) {
        if (request.getUserId() == null) {
            throw new BusinessException("创建待办失败：用户 ID 不能为空");
        }
        SysTodo todo = new SysTodo();
        todo.setUserId(request.getUserId());
        todo.setTitle(request.getTitle());
        todo.setContent(request.getContent());
        todo.setRefType(request.getRefType());
        todo.setRefId(request.getRefId());
        todo.setPriority(request.getPriority() != null ? request.getPriority() : "MEDIUM");
        todo.setDueAt(request.getDueAt());
        todo.setStatus("PENDING");
        todo.setTenantId(TenantContext.requireTenantId());
        todoMapper.insert(todo);
        log.info("待办创建成功: id={}, userId={}, title={}", todo.getId(), request.getUserId(), request.getTitle());
        return todo.getId();
    }

    @Override
    public Page<TodoResponse> listTodos(Long userId, String status, int page, int pageSize) {
        String tenantId = TenantContext.requireTenantId();
        LambdaQueryWrapper<SysTodo> wrapper = new LambdaQueryWrapper<SysTodo>()
                .eq(SysTodo::getUserId, userId)
                .and(w -> w.eq(SysTodo::getTenantId, tenantId)
                        .or().eq(SysTodo::getTenantId, "GLOBAL")); // TODO: 过渡兼容——后续执行数据迁移脚本将所有 'GLOBAL' 更新为真实 tenantId
        if (status != null && !status.isEmpty()) {
            wrapper.eq(SysTodo::getStatus, status);
        }
        wrapper.orderByDesc(SysTodo::getCreatedAt);

        Page<SysTodo> todoPage = todoMapper.selectPage(new Page<>(page, pageSize), wrapper);

        Page<TodoResponse> responsePage = new Page<>(todoPage.getCurrent(), todoPage.getSize(), todoPage.getTotal());
        responsePage.setRecords(todoPage.getRecords().stream().map(this::toResponse).collect(Collectors.toList()));
        return responsePage;
    }

    @Override
    public long getUnreadCount(Long userId) {
        String tenantId = TenantContext.requireTenantId();
        return todoMapper.selectCount(new LambdaQueryWrapper<SysTodo>()
                .eq(SysTodo::getUserId, userId)
                .eq(SysTodo::getStatus, "PENDING")
                .and(w -> w.eq(SysTodo::getTenantId, tenantId)
                        .or().eq(SysTodo::getTenantId, "GLOBAL"))); // TODO: 过渡兼容
    }

    @Override
    @Transactional
    public void markRead(Long id, Long userId) {
        SysTodo todo = todoMapper.selectById(id);
        if (todo == null) {
            throw new BusinessException("待办不存在: id=" + id);
        }
        if (!todo.getUserId().equals(userId)) {
            throw new BusinessException("无权操作此待办");
        }
        todo.setStatus("READ");
        todo.setReadAt(LocalDateTime.now());
        todoMapper.updateById(todo);
        log.info("待办标记已读: id={}", id);
    }

    @Override
    @Transactional
    public void markComplete(Long id, Long userId) {
        SysTodo todo = todoMapper.selectById(id);
        if (todo == null) {
            throw new BusinessException("待办不存在: id=" + id);
        }
        if (!todo.getUserId().equals(userId)) {
            throw new BusinessException("无权操作此待办");
        }
        todo.setStatus("COMPLETED");
        todo.setCompletedAt(LocalDateTime.now());
        todoMapper.updateById(todo);
        log.info("待办标记完成: id={}", id);
    }

    @Override
    @Transactional
    public void reassignTodo(Long id, Long newUserId, Long currentUserId) {
        SysTodo todo = todoMapper.selectById(id);
        if (todo == null) {
            throw new BusinessException("待办不存在: id=" + id);
        }
        todo.setUserId(newUserId);
        todoMapper.updateById(todo);
        log.info("待办转交: id={}, fromUserId={}, toUserId={}", id, currentUserId, newUserId);
    }

    @Override
    @Transactional
    public void completeByRef(String refType, String refId) {
        String tenantId = TenantContext.requireTenantId();
        LambdaQueryWrapper<SysTodo> wrapper = new LambdaQueryWrapper<SysTodo>()
                .eq(SysTodo::getRefType, refType)
                .eq(SysTodo::getRefId, refId)
                .and(w -> w.eq(SysTodo::getTenantId, tenantId)
                        .or().eq(SysTodo::getTenantId, "GLOBAL"))
                .in(SysTodo::getStatus, "PENDING", "READ");
        List<SysTodo> todos = todoMapper.selectList(wrapper);
        for (SysTodo todo : todos) {
            todo.setStatus("COMPLETED");
            todo.setCompletedAt(LocalDateTime.now());
            todoMapper.updateById(todo);
        }
        if (!todos.isEmpty()) {
            log.info("待办批量完成: refType={}, refId={}, count={}", refType, refId, todos.size());
        } else {
            log.debug("待办批量完成: 无待办需清理, refType={}, refId={}", refType, refId);
        }
    }

    private TodoResponse toResponse(SysTodo todo) {
        TodoResponse resp = new TodoResponse();
        resp.setId(todo.getId());
        resp.setUserId(todo.getUserId());
        resp.setTitle(todo.getTitle());
        resp.setContent(todo.getContent());
        resp.setRefType(todo.getRefType());
        resp.setRefId(todo.getRefId());
        resp.setPriority(todo.getPriority());
        resp.setDueAt(todo.getDueAt());
        resp.setStatus(todo.getStatus());
        resp.setCreatedAt(todo.getCreatedAt());
        resp.setReadAt(todo.getReadAt());
        resp.setCompletedAt(todo.getCompletedAt());
        return resp;
    }
}
