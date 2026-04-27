package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 资产折旧配置实体类
 * 
 * <p>该实体类用于管理资产折旧计算的核心配置参数，支持直线法和双倍余额递减法
 * 两种折旧计算方式。根据企业会计准则和所得税法实施条例的相关规定，
 * 系统通过本配置实现固定资产折旧的自动化计算。</p>
 * 
 * <h2>折旧方法说明</h2>
 * <ul>
 *   <li><b>LINEAR</b>: 直线法（平均年限法），每年折旧额相等</li>
 *   <li><b>DDB</b>: 双倍余额递减法，加速折旧法，年折旧率固定但基数递减</li>
 * </ul>
 * 
 * <h2>业务约束</h2>
 * <ul>
 *   <li>资产原值必须 > 0</li>
 *   <li>预计使用年限必须 >= 1（年为单位）</li>
 *   <li>残值率范围：0% ~ 50%</li>
 *   <li>净残值 = 原值 × 残值率</li>
 * </ul>
 * 
 * @author SWARM Team
 * @version 1.0.0
 * @since SWARM-003 Iteration 1
 */
@Data
@TableName("depreciation_config")
public class DepreciationConfig {

    /**
     * 主键ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 资产编码
     * <p>唯一标识资产，必须 NOT NULL 且 UNIQUE</p>
     */
    private String assetCode;

    /**
     * 资产名称
     * <p>资产的显示名称，必须 NOT NULL</p>
     */
    private String assetName;

    /**
     * 原值
     * <p>资产的原始购置价值，必须 > 0</p>
     * <p>精度：DECIMAL(18,2)</p>
     */
    private BigDecimal originalValue;

    /**
     * 预计使用年限
     * <p>资产的预计使用期限，单位：年，必须 >= 1</p>
     */
    private Integer usefulLife;

    /**
     * 残值率
     * <p>资产报废时的预计残值占原值的比例，单位：百分比</p>
     * <p>范围：0% ~ 50%，默认 5%</p>
     */
    private BigDecimal salvageRate;

    /**
     * 折旧计算方法
     * <p>可选值：LINEAR（直线法）、DDB（双倍余额递减法）</p>
     */
    private String depreciationMethod;

    /**
     * 购置日期
     * <p>资产的购置或入账日期，必须 NOT NULL</p>
     */
    private LocalDate purchaseDate;

    /**
     * 资产状态
     * <p>可选值：ACTIVE（使用中）、DISPOSED（已处置）、IMPAIRED（已减值）</p>
     * <ul>
     *   <li>DISPOSED 的资产不再计提折旧</li>
     *   <li>已全额计提折旧的资产不再计入计算</li>
     *   <li>减值处理后的资产需重新计算剩余期间</li>
     * </ul>
     */
    private String status;

    /**
     * 计算精度标度（存储精度）
     * <p>用于中间计算结果存储，避免浮点精度丢失</p>
     * <p>默认值：4（DECIMAL(18,4)）</p>
     */
    private Integer storageScale;

    /**
     * 显示精度标度
     * <p>用于最终报表展示的精度</p>
     * <p>默认值：2（DECIMAL(18,2)）</p>
     */
    private Integer displayScale;

    /**
     * 创建时间
     */
    private LocalDate createTime;

    /**
     * 更新时间
     */
    private LocalDate updateTime;

    /**
     * 折旧方法枚举
     */
    public enum DepreciationMethodEnum {
        /**
         * 直线法（平均年限法）
         * <p>年折旧额 = (原值 - 净残值) / 预计使用年限</p>
         */
        LINEAR("LINEAR", "直线法"),

        /**
         * 双倍余额递减法
         * <p>年折旧率 = 2 / 预计使用年限 × 100%</p>
         * <p>年折旧额 = 年初账面净值 × 年折旧率</p>
         */
        DDB("DDB", "双倍余额递减法");

        private final String code;
        private final String description;

        DepreciationMethodEnum(String code, String description) {
            this.code = code;
            this.description = description;
        }

        public String getCode() {
            return code;
        }

        public String getDescription() {
            return description;
        }

        /**
         * 根据编码获取枚举值
         *
         * @param code 折旧方法编码
         * @return 对应的枚举值，如果未找到返回 null
         */
        public static DepreciationMethodEnum fromCode(String code) {
            for (DepreciationMethodEnum method : values()) {
                if (method.code.equalsIgnoreCase(code)) {
                    return method;
                }
            }
            return null;
        }
    }

    /**
     * 资产状态枚举
     */
    public enum AssetStatusEnum {
        /**
         * 使用中
         */
        ACTIVE("ACTIVE", "使用中"),

        /**
         * 已处置
         */
        DISPOSED("DISPOSED", "已处置"),

        /**
         * 已减值
         */
        IMPAIRED("IMPAIRED", "已减值");

        private final String code;
        private final String description;

        AssetStatusEnum(String code, String description) {
            this.code = code;
            this.description = description;
        }

        public String getCode() {
            return code;
        }

        public String getDescription() {
            return description;
        }
    }

    /**
     * 计算净残值
     * <p>净残值 = 原值 × 残值率</p>
     *
     * @return 净残值
     */
    public BigDecimal calculateNetSalvageValue() {
        if (originalValue == null || salvageRate == null) {
            return BigDecimal.ZERO;
        }
        return originalValue.multiply(salvageRate.divide(new BigDecimal("100"), 4, java.math.RoundingMode.HALF_UP));
    }

    /**
     * 计算应折旧总额
     * <p>应折旧总额 = 原值 - 净残值</p>
     *
     * @return 应折旧总额
     */
    public BigDecimal calculateDepreciableAmount() {
        return originalValue.subtract(calculateNetSalvageValue());
    }

    /**
     * 验证原值是否有效
     * <p>原值必须 > 0</p>
     *
     * @return true 如果原值有效
     */
    public boolean isOriginalValueValid() {
        return originalValue != null && originalValue.compareTo(BigDecimal.ZERO) > 0;
    }

    /**
     * 验证使用年限是否有效
     * <p>使用年限必须 >= 1</p>
     *
     * @return true 如果使用年限有效
     */
    public boolean isUsefulLifeValid() {
        return usefulLife != null && usefulLife >= 1;
    }

    /**
     * 验证残值率是否在有效范围内
     * <p>残值率范围：0% ~ 50%</p>
     *
     * @return true 如果残值率有效
     */
    public boolean isSalvageRateValid() {
        if (salvageRate == null) {
            return false;
        }
        BigDecimal zero = BigDecimal.ZERO;
        BigDecimal maxRate = new BigDecimal("50");
        return salvageRate.compareTo(zero) >= 0 && salvageRate.compareTo(maxRate) <= 0;
    }

    /**
     * 验证折旧方法是否有效
     *
     * @return true 如果折旧方法有效
     */
    public boolean isDepreciationMethodValid() {
        if (depreciationMethod == null) {
            return false;
        }
        return DepreciationMethodEnum.fromCode(depreciationMethod) != null;
    }

    /**
     * 验证资产状态是否为使用中
     * <p>只有 ACTIVE 状态的资产才会参与折旧计算</p>
     *
     * @return true 如果状态为使用中
     */
    public boolean isActive() {
        return AssetStatusEnum.ACTIVE.getCode().equals(status);
    }

    /**
     * 验证配置是否有效
     * <p>综合验证原值、使用年限、残值率、折旧方法的有效性</p>
     *
     * @return true 如果配置完全有效
     */
    public boolean isValid() {
        return isOriginalValueValid() 
                && isUsefulLifeValid() 
                && isSalvageRateValid() 
                && isDepreciationMethodValid();
    }

    /**
     * 获取双倍余额递减法的年折旧率
     * <p>年折旧率 = 2 / 预计使用年限 × 100%</p>
     *
     * @return 年折旧率（百分比形式）
     */
    public BigDecimal getDdbAnnualRate() {
        if (usefulLife == null || usefulLife <= 0) {
            return BigDecimal.ZERO;
        }
        return new BigDecimal("2")
                .divide(new BigDecimal(usefulLife), 4, java.math.RoundingMode.HALF_UP)
                .multiply(new BigDecimal("100"));
    }

    /**
     * 判断是否应转换为直线法
     * <p>双倍余额递减法在最后两年应转换为直线法</p>
     *
     * @param currentYear 当前折旧年度（从1开始）
     * @return true 如果应转换为直线法
     */
    public boolean shouldSwitchToLinear(int currentYear) {
        if (usefulLife == null) {
            return false;
        }
        return currentYear > usefulLife - 2;
    }
}