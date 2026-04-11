package com.ams.controller;

import com.ams.entity.Location;
import com.ams.service.LocationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/locations")
public class LocationController {

    @Autowired
    private LocationService locationService;

    @GetMapping("/{id}")
    public Location findById(@PathVariable Long id) {
        return locationService.findById(id);
    }

    @PostMapping
    public void insert(@RequestBody Location location) {
        locationService.insert(location);
    }

    @PutMapping
    public void update(@RequestBody Location location) {
        locationService.update(location);
    }

    @DeleteMapping("/{id}")
    public void deleteById(@PathVariable Long id) {
        locationService.deleteById(id);
    }

    @GetMapping("/hierarchy/{id}")
    public List<Location> findLocationHierarchy(@PathVariable Long id) {
        return locationService.findLocationHierarchy(id);
    }

    @GetMapping("/root")
    public List<Location> findRootLocations() {
        return locationService.findRootLocations();
    }

    @GetMapping("/children/{parentId}")
    public List<Location> findChildrenByParentId(@PathVariable Long parentId) {
        return locationService.findChildrenByParentId(parentId);
    }

    @GetMapping("/descendants/{id}")
    public List<Location> findDescendants(@PathVariable Long id) {
        return locationService.findDescendants(id);
    }
}
