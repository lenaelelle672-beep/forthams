package com.ams.mapper;

import com.ams.entity.InventoryDetail;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Set;

@Mapper
public interface InventoryDetailMapper extends BaseMapper<InventoryDetail> {

    /**
     * 创建任务时一次性固化真实资产清单；后续扫描仅更新这些关联行，不能把任意资产插入任务。
     */
    @Insert("""
            <script>
            INSERT INTO inventory_detail
                (task_id, tenant_id, asset_id, rfid_tag, status, expected_location, create_time)
            SELECT #{taskId}, #{tenantId}, asset.id, asset.rfid_tag, 'PENDING', asset.location, CURRENT_TIMESTAMP
            FROM asset
            WHERE asset.tenant_id = #{tenantId}
              AND asset.deleted = 0
              AND asset.dept_id IN
              <foreach collection="departmentIds" item="departmentId" open="(" separator="," close=")">
                  #{departmentId}
              </foreach>
            </script>
            """)
    int insertTaskAssetSnapshot(@Param("taskId") Long taskId,
                                @Param("tenantId") String tenantId,
                                @Param("departmentIds") Set<Long> departmentIds);
}
