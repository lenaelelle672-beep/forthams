package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class InventoryScanDTO {

    @NotNull(message = "资产ID不能为空")
    @Positive(message = "资产ID必须为正整数")
    private Long assetId;
    @Size(max = 128, message = "RFID标签不能超过128个字符")
    @Pattern(regexp = "[A-Za-z0-9._:-]*", message = "RFID标签格式不合法")
    private String rfidTag;
    @NotBlank(message = "盘点结果不能为空")
    @Pattern(regexp = "(?i)MATCH|MISMATCH|SURPLUS|LOSS|NORMAL|DEFICIT|DAMAGED|OTHER",
            message = "盘点结果不合法")
    private String status;
    @Size(max = 256, message = "账面地点不能超过256个字符")
    private String expectedLocation;
    @Size(max = 256, message = "实际地点不能超过256个字符")
    private String actualLocation;
    @PastOrPresent(message = "扫描时间不能晚于当前时间")
    private LocalDateTime scanTime;
    @Size(max = 512, message = "盘点备注不能超过512个字符")
    private String remark;
}
