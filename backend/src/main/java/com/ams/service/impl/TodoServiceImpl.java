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
 * 待办服务实现（占位符）
 * 
 * <p>这是一个临时实现，用于解决编译问题。
 * 完整的 Todo 功能应在后续版本中实现。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TodoServiceImpl implements TodoService {

    private final TodoMapper todoMapper; // 占位符，实际使用时会编译失败

    @Override
    @Transactional
    public Long createTodo(TodoCreateRequest request) {
        log.warn("Todo 功能未完全实现，返回占位符 ID");
        return -1L;
    }

    @Override
    public Page<TodoResponse> listTodos(Long userId, String status, int page, int pageSize) {
        log.warn("Todo 功能未完全实现，返回空列表");
        return new Page<>(page, pageSize, 0);
    }

    @Override
    public long getUnreadCount(Long userId) {
        log.warn("Todo 功能未完全实现，返回 0");
        return 0;
    }

    @Override
    @Transactional
    public void markRead(Long id, Long userId) {
        log.warn("Todo 功能未完全实现，markRead 被调用: id={}", id);
    }

    @Override
    @Transactional
    public void markComplete(Long id, Long userId) {
        log.warn("Todo 功能未完全实现，markComplete 被调用: id={}", id);
    }

    @Override
    @Transactional
    public void reassignTodo(Long id, Long newUserId, Long currentUserId) {
        log.warn("Todo 功能未完全实现，reassignTodo 被调用: id={}", id);
    }

    @Override
    @Transactional
    public void completeByRef(String refType, String refId) {
        log.warn("Todo 功能未完全实现，completeByRef 被调用: refType={}, refId={}", refType, refId);
    }
}