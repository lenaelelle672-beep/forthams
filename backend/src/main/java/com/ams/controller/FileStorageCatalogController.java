package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.FileStorageAttachmentCatalogDTO;
import com.ams.service.FileStorageCatalogService;
import com.ams.service.TenantAuthorityService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/system/file-storage/attachments")
@RequiredArgsConstructor
public class FileStorageCatalogController {

    private final FileStorageCatalogService fileStorageCatalogService;
    private final TenantAuthorityService tenantAuthorityService;

    @GetMapping("/catalog")
    public Result<FileStorageAttachmentCatalogDTO> getCatalog(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String businessType,
            @RequestParam(required = false) String fileType,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageSize
    ) {
        tenantAuthorityService.requirePlatformAdmin();
        return Result.success(fileStorageCatalogService.getAttachmentCatalog(keyword, businessType, fileType, page, pageSize));
    }
}
