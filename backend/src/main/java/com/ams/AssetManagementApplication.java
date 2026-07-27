package com.ams;

import lombok.extern.slf4j.Slf4j;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 资产管理系统启动类
 *
 * @author AMS Team
 * @since 2024-03-28
 */
@Slf4j
@SpringBootApplication
@MapperScan("com.ams.mapper")
public class AssetManagementApplication {

    public static void main(String[] args) {
        SpringApplication.run(AssetManagementApplication.class, args);
        log.info("Asset Management System started successfully");
    }

}
