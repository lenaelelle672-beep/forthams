package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.Location;
import com.ams.service.LocationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/locations")
@RequiredArgsConstructor
public class LocationController {
    private final LocationService locationService;

    @GetMapping("/list")
    public Result<List<Location>> list() {
        return Result.success(locationService.findRootLocations());
    }

    @GetMapping("/root")
    public Result<List<Location>> root() {
        return Result.success(locationService.findRootLocations());
    }

    @GetMapping("/{id}")
    public Result<Location> getById(@PathVariable Long id) {
        return Result.success(locationService.findById(id));
    }

    @PostMapping
    public Result<Location> create(@RequestBody Location location) {
        locationService.insert(location);
        return Result.success(location);
    }

    @PutMapping("/{id}")
    public Result<Location> update(@PathVariable Long id, @RequestBody Location location) {
        location.setId(id);
        locationService.update(location);
        return Result.success(location);
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        locationService.deleteById(id);
        return Result.success();
    }

    @PutMapping("/reorder")
    public Result<Void> reorder(@RequestBody List<Map<String, Object>> items) {
        for (Map<String, Object> item : items) {
            Long locationId = Long.valueOf(item.get("id").toString());
            Location location = locationService.findById(locationId);
            if (location != null) {
                if (item.containsKey("parentId")) {
                    Object parentIdObj = item.get("parentId");
                    location.setParentId(parentIdObj != null ? Long.valueOf(parentIdObj.toString()) : null);
                }
                if (item.containsKey("sortOrder")) {
                    location.setSortOrder(Integer.valueOf(item.get("sortOrder").toString()));
                }
                locationService.update(location);
            }
        }
        return Result.success();
    }
}
