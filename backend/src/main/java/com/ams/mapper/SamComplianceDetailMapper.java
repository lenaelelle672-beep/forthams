package com.ams.mapper;
import com.ams.entity.SamComplianceDetail;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface SamComplianceDetailMapper extends BaseMapper<SamComplianceDetail> {
    @Select("SELECT * FROM sam_compliance_detail WHERE scan_id = #{scanId} ORDER BY created_at DESC")
    List<SamComplianceDetail> findByScanId(Long scanId);

    @Select("SELECT * FROM sam_compliance_detail WHERE scan_id = #{scanId} AND risk_level = 'HIGH' ORDER BY created_at DESC")
    List<SamComplianceDetail> findHighRiskByScanId(Long scanId);
}
