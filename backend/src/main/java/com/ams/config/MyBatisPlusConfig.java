package com.ams.config;

import com.ams.datascope.AmsDataPermissionHandler;
import com.ams.datascope.DataScopeDecisionService;
import com.ams.datascope.DataScopeTableRegistry;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.RoleMapper;
import com.ams.mapper.SysRoleDeptMapper;
import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.DataPermissionInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MyBatisPlusConfig {

    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor(
            DataScopeDecisionService decisionService,
            DataScopeTableRegistry tableRegistry,
            ObjectProvider<DeptMapper> deptMapper,
            ObjectProvider<RoleMapper> roleMapper,
            ObjectProvider<SysRoleDeptMapper> sysRoleDeptMapper) {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        AmsDataPermissionHandler handler = new AmsDataPermissionHandler(
                decisionService, tableRegistry, deptMapper, roleMapper, sysRoleDeptMapper);
        interceptor.addInnerInterceptor(new DataPermissionInterceptor(handler));
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        return interceptor;
    }
}
