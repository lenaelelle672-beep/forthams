package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.Location;
import com.ams.service.LocationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;

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

    @GetMapping("/tree")
    public Result<List<Location>> tree() {
        List<Location> roots = locationService.findRootLocations();
        populateChildren(roots);
        return Result.success(roots);
    }

    @GetMapping("/{id}")
    public Result<Location> getById(@PathVariable Long id) {
        return Result.success(locationService.findById(id));
    }

    private void populateChildren(List<Location> nodes) {
        for (Location node : nodes == null ? Collections.<Location>emptyList() : nodes) {
            List<Location> children = locationService.findChildrenByParentId(node.getId());
            node.setChildren(children);
            populateChildren(children);
        }
    }

    @PostMapping
    public Result<Location> create(@RequestBody Location location) {
        // 防止 mass assignment：清除客户端不应设置的字段
        location.setId(null);
        location.setDeleted(0);
        location.setCreateTime(null);
        location.setUpdateTime(null);
        locationService.insert(location);
        return Result.success(location);
    }
}
