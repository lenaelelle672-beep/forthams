package com.ams.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("sys_operate_log")
public class SysOperateLog implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String module;
    private String operation;
    private String businessType;
    private String method;
    private String requestMethod;
    private String requestUri;
    private Long operatorId;
    private String operatorName;
    private String operatorIp;
    private String requestParams;
    private String responseData;
    private Integer status;
    private String errorMessage;
    private Long costTime;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
