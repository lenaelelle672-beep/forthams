package com.ams.controller;

import com.ams.common.annotation.Auditable;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/assets")
public class AssetController {

    @Auditable(action = "CREATE")
    @PostMapping
    public void createAsset(@RequestBody String asset) {
        // Logic to create an asset
    }

    @Auditable(action = "UPDATE")
    @PutMapping("/{id}")
    public void updateAsset(@PathVariable String id, @RequestBody String asset) {
        // Logic to update an asset
    }

    @Auditable(action = "DELETE")
    @DeleteMapping("/{id}")
    public void deleteAsset(@PathVariable String id) {
        // Logic to delete an asset
    }
}
