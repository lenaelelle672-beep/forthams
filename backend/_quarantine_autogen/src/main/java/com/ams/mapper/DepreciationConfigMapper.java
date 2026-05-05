package com.ams.mapper;

import com.ams.entity.DepreciationConfig;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 折旧配置 Mapper 接口
 * 
 * <p>提供折旧配置数据的数据库访问能力，支持直线法和双倍余额递减法
 * 两种折旧方式的配置管理。
 * 
 * <p>主要功能：
 * <ul>
 *   <li>查询资产适用的折旧配置</li>
 *   <li>获取折旧方法定义</li>
 *   <li>验证配置有效性</li>
 * </ul>
 *
 * @author AMS Team
 * @version 1.0.0
 * @since Iteration 1
 */
@Mapper
public interface DepreciationConfigMapper extends BaseMapper<DepreciationConfig> {

    /**
     * 根据资产类别ID查询折旧配置
     * 
     * <p>此方法根据资产类别ID查找适用的折旧配置规则，
     * 包括默认折旧方法和年限设置。
     * 
     * @param categoryId 资产类别ID，不能为空
     * @return 对应的折旧配置实体，如果未找到则返回null
     * 
     * @example
     * <pre>
     * DepreciationConfig config = mapper.findByCategoryId(1L);
     * if (config != null) {
     *     String method = config.getDepreciationMethod();
     *     Integer years = config.getDefaultUsefulLifeYears();
     * }
     * </pre>
     */
    @Select("SELECT * FROM depreciation_config WHERE category_id = #{categoryId} AND is_active = 1 LIMIT 1")
    DepreciationConfig findByCategoryId(@Param("categoryId") Long categoryId);

    /**
     * 根据折旧方法代码查询配置
     * 
     * <p>折旧方法代码定义：
     * <ul>
     *   <li>STRAIGHT_LINE - 直线法（平均年限法）</li>
     *   <li>DOUBLE_DECLINING - 双倍余额递减法</li>
     * </ul>
     * 
     * @param methodCode 折旧方法代码，非空字符串
     * @return 折旧配置实体，如果未找到则返回null
     * 
     * @see com.ams.enums.DepreciationMethod
     */
    @Select("SELECT * FROM depreciation_config WHERE depreciation_method = #{methodCode} AND is_active = 1 LIMIT 1")
    DepreciationConfig findByMethodCode(@Param("methodCode") String methodCode);

    /**
     * 验证折旧配置是否有效
     * 
     * <p>检查配置是否满足以下条件：
     * <ul>
     *   <li>配置存在且已激活</li>
     *   <li>折旧方法代码有效</li>
     *   <li>使用年限大于0</li>
     * </ul>
     * 
     * @param configId 折旧配置ID
     * @return true表示配置有效，false表示配置无效或不存在
     */
    @Select("SELECT COUNT(*) > 0 FROM depreciation_config WHERE id = #{configId} AND is_active = 1 AND depreciation_method IS NOT NULL AND default_useful_life_years > 0")
    boolean isValidConfig(@Param("configId") Long configId);

    /**
     * 获取默认折旧配置
     * 
     * <p>当资产未指定特定折旧配置时，使用系统默认配置。
     * 默认配置通常采用直线法，标准使用年限为5年。
     * 
     * @return 系统默认折旧配置实体
     * @throws RuntimeException 当默认配置不存在时抛出异常
     */
    @Select("SELECT * FROM depreciation_config WHERE is_default = 1 AND is_active = 1 LIMIT 1")
    DepreciationConfig findDefaultConfig();
}