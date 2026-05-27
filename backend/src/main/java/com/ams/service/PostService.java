package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.SysPost;
import com.ams.entity.SysUserPost;
import com.ams.mapper.SysPostMapper;
import com.ams.mapper.SysUserPostMapper;
import com.ams.security.SecurityUserCacheService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PostService {

    private final SysPostMapper sysPostMapper;
    private final SysUserPostMapper sysUserPostMapper;
    private final SecurityUserCacheService securityUserCacheService;

    public PostService(SysPostMapper sysPostMapper,
                       SysUserPostMapper sysUserPostMapper,
                       SecurityUserCacheService securityUserCacheService) {
        this.sysPostMapper = sysPostMapper;
        this.sysUserPostMapper = sysUserPostMapper;
        this.securityUserCacheService = securityUserCacheService;
    }

    public Page<SysPost> queryPosts(Integer page, Integer pageSize, String keyword) {
        Page<SysPost> pager = new Page<>(page, pageSize);
        QueryWrapper<SysPost> wrapper = new QueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like("post_code", keyword).or().like("post_name", keyword));
        }
        wrapper.orderByAsc("sort_order");
        return sysPostMapper.selectPage(pager, wrapper);
    }

    public List<SysPost> listAll() {
        return sysPostMapper.selectList(
                new QueryWrapper<SysPost>().eq("status", 1).orderByAsc("sort_order"));
    }

    public SysPost getById(Long id) {
        SysPost post = sysPostMapper.selectById(id);
        if (post == null) {
            throw new BusinessException("岗位不存在");
        }
        return post;
    }

    @Transactional(rollbackFor = Exception.class)
    public SysPost create(SysPost post) {
        if (post.getSortOrder() == null) post.setSortOrder(0);
        if (post.getStatus() == null) post.setStatus(1);
        sysPostMapper.insert(post);
        securityUserCacheService.evictAll();
        return post;
    }

    @Transactional(rollbackFor = Exception.class)
    public SysPost update(Long id, SysPost updates) {
        SysPost post = getById(id);
        if (updates.getPostCode() != null) post.setPostCode(updates.getPostCode());
        if (updates.getPostName() != null) post.setPostName(updates.getPostName());
        if (updates.getSortOrder() != null) post.setSortOrder(updates.getSortOrder());
        if (updates.getStatus() != null) post.setStatus(updates.getStatus());
        if (updates.getRemark() != null) post.setRemark(updates.getRemark());
        sysPostMapper.updateById(post);
        securityUserCacheService.evictAll();
        return post;
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        getById(id);
        sysPostMapper.deleteById(id);
        securityUserCacheService.evictAll();
    }

    public List<Long> getUserPostIds(Long userId) {
        return sysUserPostMapper.selectPostIdsByUserId(userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void assignUserPosts(Long userId, List<Long> postIds) {
        sysUserPostMapper.deleteByUserId(userId);
        if (postIds != null && !postIds.isEmpty()) {
            for (Long postId : postIds) {
                SysUserPost up = new SysUserPost();
                up.setUserId(userId);
                up.setPostId(postId);
                sysUserPostMapper.insert(up);
            }
        }
        securityUserCacheService.evictAll();
    }
}
