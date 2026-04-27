package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.Location;
import com.ams.service.LocationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

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

    @GetMapping("/{id}")
    public Result<Location> getById(@PathVariable Long id) {
        return Result.success(locationService.findById(id));
    }

    @GetMapping("/{id}/children")
    public Result<List<Location>> children(@PathVariable Long id) {
        return Result.success(locationService.findChildrenByParentId(id));
    }

    @GetMapping("/root")
    public Result<List<Location>> root() {
        return Result.success(locationService.findRootLocations());
    }

    @PostMapping
    public Result<Void> create(@RequestBody Location location) {
        locationService.insert(location);
        return Result.success();
    }

    @PutMapping("/{id}")
    public Result<Void> update(@PathVariable Long id, @RequestBody Location location) {
        location.setId(id);
        locationService.update(location);
        return Result.success();
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        locationService.deleteById(id);
        return Result.success();
    }
}
