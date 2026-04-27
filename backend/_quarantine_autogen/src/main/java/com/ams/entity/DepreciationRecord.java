package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 资产折旧记录实体类
 * 
 * 功能描述：
 * - 存储按直线法或双倍余额递减法计算的资产折旧信息
 * - 记录每个折旧期间(月份)的折旧金额和账面净值
 * - 支持折旧方法的动态切换(双倍余额递减法后期转为直线法)
 * 
 * 业务规则：
 * - 折旧计算精度：金额保留2位小数，角位四舍五入
 * - 使用年限范围：1-50年
 * - 折旧计提终止：当累计折旧 = 原值 - 残值时停止
 * - 折旧计提起始：基于资产购置日期的下月首日
 * 
 * @since SWARM-003 资产折旧计算模块
 */
@Data
@TableName("depreciation_records")
public class DepreciationRecord {
    
    /**
     * 主键ID
     */
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    
    /**
     * 资产ID - 关联资产主数据
     */
    private Long assetId;
    
    /**
     * 折旧期间 - 格式：YYYY-MM (如 2024-01)
     * 用于按月归集折旧记录
     */
    private String period;
    
    /**
     * 当期折旧金额
     * 精度：保留2位小数
     */
    private BigDecimal depreciationAmount;
    
    /**
     * 期初账面价值(年初净值)
     * 用于双倍余额递减法计算
     */
    private BigDecimal openingBookValue;
    
    /**
     * 期末账面价值
     * 计算公式：期初账面价值 - 当期折旧金额
     */
    private BigDecimal closingBookValue;
    
    /**
     * 累计折旧金额
     * 从资产购置到当前期间的累计折旧总和
     */
    private BigDecimal accumulatedDepreciation;
    
    /**
     * 折旧方法
     * 枚举值：straight_line(直线法) / double_declining_balance(双倍余额递减法)
     */
    private String depreciationMethod;
    
    /**
     * 年折旧率
     * 直线法：1/使用年限
     * 双倍余额递减法：2/使用年限
     */
    private BigDecimal annualDepreciationRate;
    
    /**
     * 预计使用年限(年)
     * 范围：1-50年
     */
    private Integer usefulLifeYears;
    
    /**
     * 预计残值
     * 折旧终止时的剩余价值
     */
    private BigDecimal salvageValue;
    
    /**
     * 折旧期间开始日期
     * 格式：YYYY-MM-01
     */
    private LocalDate periodStartDate;
    
    /**
     * 折旧期间结束日期
     * 格式：YYYY-MM-LastDay
     */
    private LocalDate periodEndDate;
    
    /**
     * 是否已结账
     * true-已结账不可修改，false-未结账可调整
     */
    private Boolean isClosed;
    
    /**
     * 创建时间
     */
    private LocalDateTime createdTime;
    
    /**
     * 更新时间
     */
    private LocalDateTime updatedTime;
    
    /**
     * 创建人
     */
    private String createdBy;
    
    /**
     * 更新人
     */
    private String updatedBy;
    
    /**
     * 备注说明
     * 用于记录折旧方法切换原因等
     */
    private String remark;
}