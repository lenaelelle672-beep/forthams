package com.ams.mapper;
import com.ams.entity.Contract;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import java.time.LocalDate;
import java.util.List;
@Mapper
public interface ContractMapper extends BaseMapper<Contract> {
    @Select("SELECT * FROM contract WHERE deleted=0 AND end_date BETWEEN #{today} AND #{future} ORDER BY end_date ASC")
    List<Contract> findExpiring(LocalDate today, LocalDate future);
}
