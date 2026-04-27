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

    @GetMapping("/root")
    public Result<List<Location>> root() {
        return Result.success(locationService.findRootLocations());
    }

    @GetMapping("/{id}")
    public Result<Location> getById(@PathVariable Long id) {
        return Result.success(locationService.findById(id));
    }
}
