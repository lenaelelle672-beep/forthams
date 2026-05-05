package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.XxxCreateDTO;
import com.ams.dto.XxxUpdateDTO;
import com.ams.entity.Xxx;
import com.ams.mapper.XxxMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Xxx Service Tests")
class XxxServiceTest {

    @Mock
    private XxxMapper xxxMapper;

    @InjectMocks
    private XxxService xxxService;

    @Test
    @DisplayName("Should return page when querying")
    void testQuery() {
        Page<Xxx> mockPage = new Page<>();
        when(xxxMapper.selectPage(any(), any())).thenReturn(mockPage);

        Page<Xxx> result = xxxService.queryXxx(1, 10);

        assertThat(result).isNotNull();
        verify(xxxMapper).selectPage(any(), any());
    }

    @Test
    @DisplayName("Should return item when found by ID")
    void testGetByIdSuccess() {
        Xxx mockXxx = new Xxx();
        when(xxxMapper.selectById(1L)).thenReturn(mockXxx);

        Xxx result = xxxService.getById(1L);

        assertThat(result).isNotNull();
        verify(xxxMapper).selectById(1L);
    }

    @Test
    @DisplayName("Should throw exception when item not found")
    void testGetByIdNotFound() {
        when(xxxMapper.selectById(1L)).thenReturn(null);

        assertThatThrownBy(() -> xxxService.getById(1L))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("不存在");

        verify(xxxMapper).selectById(1L);
    }

    @Test
    @DisplayName("Should create successfully with valid data")
    void testCreate() {
        XxxCreateDTO createDTO = new XxxCreateDTO();
        when(xxxMapper.insert(any(Xxx.class))).thenReturn(1);

        Xxx result = xxxService.create(createDTO);

        assertThat(result).isNotNull();
        verify(xxxMapper).insert(any(Xxx.class));
    }

    @Test
    @DisplayName("Should update successfully with valid data")
    void testUpdate() {
        Xxx existingXxx = new Xxx();
        when(xxxMapper.selectById(1L)).thenReturn(existingXxx);
        when(xxxMapper.updateById(any(Xxx.class))).thenReturn(1);

        Xxx result = xxxService.update(1L, new XxxUpdateDTO());

        assertThat(result).isNotNull();
        verify(xxxMapper).selectById(1L);
        verify(xxxMapper).updateById(any(Xxx.class));
    }

    @Test
    @DisplayName("Should delete successfully when item exists")
    void testDelete() {
        Xxx existingXxx = new Xxx();
        when(xxxMapper.selectById(1L)).thenReturn(existingXxx);
        when(xxxMapper.deleteById(1L)).thenReturn(1);

        assertThatCode(() -> xxxService.delete(1L)).doesNotThrowAnyException();

        verify(xxxMapper).selectById(1L);
        verify(xxxMapper).deleteById(1L);
    }

    @Test
    @DisplayName("Should throw exception when deleting non-existent item")
    void testDeleteNotFound() {
        when(xxxMapper.selectById(1L)).thenReturn(null);

        assertThatThrownBy(() -> xxxService.delete(1L))
            .isInstanceOf(BusinessException.class);

        verify(xxxMapper).selectById(1L);
        verify(xxxMapper, never()).deleteById(any());
    }
}
