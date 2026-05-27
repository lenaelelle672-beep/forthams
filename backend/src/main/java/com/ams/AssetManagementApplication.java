package com.ams;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 资产管理系统启动类
 *
 * @author AMS Team
 * @since 2024-03-28
 */
@SpringBootApplication
@EnableScheduling
@EnableAsync
@EnableCaching
@MapperScan("com.ams.mapper")
public class AssetManagementApplication {

    public static void main(String[] args) {
        SpringApplication.run(AssetManagementApplication.class, args);
    }

}
