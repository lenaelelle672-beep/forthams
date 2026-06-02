package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.Manufacturer;
import com.ams.mapper.ManufacturerMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ManufacturerService {

    private final ManufacturerMapper manufacturerMapper;

    public Page<Manufacturer> getPage(Integer page, Integer pageSize, String keyword, Integer status) {
        LambdaQueryWrapper<Manufacturer> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            wrapper.like(Manufacturer::getName, keyword)
                   .or().like(Manufacturer::getCode, keyword);
        }
        if (status != null) {
            wrapper.eq(Manufacturer::getStatus, status);
        }
        wrapper.orderByAsc(Manufacturer::getName);
        return manufacturerMapper.selectPage(new Page<>(page, pageSize), wrapper);
    }

    public List<Manufacturer> getOptions() {
        return manufacturerMapper.selectList(new LambdaQueryWrapper<Manufacturer>()
                .eq(Manufacturer::getStatus, 0)
                .select(Manufacturer::getId, Manufacturer::getName, Manufacturer::getCode));
    }

    public Manufacturer getById(Long id) {
        Manufacturer m = manufacturerMapper.selectById(id);
        if (m == null) throw new BusinessException("制造商不存在");
        return m;
    }

    public Manufacturer create(Manufacturer m) {
        if (m.getCode() != null) {
            Long cnt = manufacturerMapper.selectCount(new LambdaQueryWrapper<Manufacturer>()
                    .eq(Manufacturer::getCode, m.getCode()));
            if (cnt > 0) throw new BusinessException("编码已存在: " + m.getCode());
        }
        manufacturerMapper.insert(m);
        return m;
    }

    public Manufacturer update(Long id, Manufacturer m) {
        getById(id);
        m.setId(id);
        manufacturerMapper.updateById(m);
        return m;
    }

    public void delete(Long id) {
        getById(id);
        manufacturerMapper.deleteById(id);
    }
}
