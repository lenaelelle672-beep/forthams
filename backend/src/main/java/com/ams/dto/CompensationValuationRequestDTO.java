package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CompensationValuationRequestDTO {

    @NotNull(message = "资产不能为空")
    @Positive(message = "资产ID必须为正数")
    private Long assetId;

    @JsonAlias({"type", "compensationType"})
    @NotBlank(message = "赔偿类型不能为空")
    @Size(max = 32, message = "赔偿类型长度不能超过32个字符")
    private String compensationType;
}
