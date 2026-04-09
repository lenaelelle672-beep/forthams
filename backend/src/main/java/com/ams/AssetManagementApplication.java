package com.ams;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 资产管理系统启动类
 * 
 * @author AMS Team
 * @since 2024-03-28
 */
@SpringBootApplication
@MapperScan("com.ams.mapper")
public class AssetManagementApplication {

    public static void main(String[] args) {
        SpringApplication.run(AssetManagementApplication.class, args);
        System.out.println("\n========================================");
        System.out.println("  Asset Management System Started!");
        System.out.println("  API Base URL: http://localhost:8080/api");
        System.out.println("========================================\n");
    }

}
