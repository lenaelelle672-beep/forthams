package com.ams.mapper;
import com.ams.entity.SoftwareLicense;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import java.time.LocalDate;
import java.util.List;
@Mapper
public interface SoftwareLicenseMapper extends BaseMapper<SoftwareLicense> {
    @Select("SELECT * FROM software_license WHERE deleted=0 AND expiry_date BETWEEN #{today} AND #{future} ORDER BY expiry_date ASC")
    List<SoftwareLicense> findExpiring(LocalDate today, LocalDate future);
}
