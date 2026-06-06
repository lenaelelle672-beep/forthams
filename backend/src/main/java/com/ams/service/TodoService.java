package com.ams.service;

import com.ams.dto.TodoCreateRequest;
import com.ams.dto.TodoResponse;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.util.List;

/**
 * 待办服务接口
 *
 * <p>管理用户待办的完整生命周期：创建、分页查询、未读计数、标记已读/完成。</p>
 */
public interface TodoService {

    /**
     * 创建待办
     *
     * @param request 创建请求
     * @return 创建的待办 ID
     */
    Long createTodo(TodoCreateRequest request);

    /**
     * 分页查询用户待办列表
     *
     * @param userId   用户 ID
     * @param status   状态过滤 (PENDING/READ/COMPLETED, null 表示全部)
     * @param page     页码
     * @param pageSize 每页条数
     * @return 分页结果
     */
    Page<TodoResponse> listTodos(Long userId, String status, int page, int pageSize);

    /**
     * 获取用户未读待办数
     *
     * @param userId 用户 ID
     * @return 未读待办数
     */
    long getUnreadCount(Long userId);

    /**
     * 标记待办为已读
     *
     * @param id     待办 ID
     * @param userId 用户 ID (租户隔离)
     */
    void markRead(Long id, Long userId);

    /**
     * 标记待办为已完成
     *
     * @param id     待办 ID
     * @param userId 用户 ID (租户隔离)
     */
    void markComplete(Long id, Long userId);

    /**
     * 转交待办 (本期暂不实现, 作为 stub 保留)
     *
     * @param id          待办 ID
     * @param newUserId   新用户 ID
     * @param currentUserId 当前用户 ID
     */
    void reassignTodo(Long id, Long newUserId, Long currentUserId);

    /**
     * 按引用类型和引用 ID 批量完成待办（标记为 COMPLETED）。
     * <p>用于审批驳回/取消时清理关联待办。</p>
     *
     * @param refType 引用类型（如 APPROVAL_PROCESS）
     * @param refId   引用 ID
     */
    void completeByRef(String refType, String refId);
}
