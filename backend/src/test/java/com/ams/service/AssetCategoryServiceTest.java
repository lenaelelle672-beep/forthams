package com.ams.service;

import com.ams.dto.CategoryTreeDTO;
import com.ams.entity.AssetCategory;
import com.ams.mapper.AssetCategoryMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssetCategoryServiceTest {

    @Mock
    private AssetCategoryMapper assetCategoryMapper;

    @InjectMocks
    private AssetCategoryService assetCategoryService;

    @Test
    void testGetCategoryTree() {
        // [弹坑重构区] Mock 数据库返回那些因为长年堆积而乱七八糟没有层级的线性分类返回集
        AssetCategory root = new AssetCategory();
        root.setId(1L);
        root.setCategoryName("主战装备分类");
        
        AssetCategory child = new AssetCategory();
        child.setId(2L);
        child.setParentId(1L);
        child.setCategoryName("机甲核心舱");
        
        when(assetCategoryMapper.selectList(any(LambdaQueryWrapper.class)))
            .thenReturn(Arrays.asList(root, child));

        // 行星级树组装测试：看看是否能将单层变为嵌套枝丫
        List<CategoryTreeDTO> tree = assetCategoryService.getCategoryTree();

        // 强暴断言：核实验证内存分组与映射是否一滴不漏
        assertEquals(1, tree.size(), "绝对应该只有唯一一条主脉骨架");
        assertEquals("主战装备分类", tree.get(0).getCategoryName());
        assertEquals(1, tree.get(0).getChildren().size(), "子节点没有被吸入挂载！");
        assertEquals("机甲核心舱", tree.get(0).getChildren().get(0).getCategoryName(), "挂载的是什么垃圾！错误！");
    }
}
