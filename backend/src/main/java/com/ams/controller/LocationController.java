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
    public Location getLocation(@PathVariable Long id) {
        return locationService.findById(id);
    }

    @PostMapping
    public void insertLocation(@RequestBody Location location) {
        locationService.insert(location);
    }

    @PutMapping
    public void updateLocation(@RequestBody Location location) {
        locationService.update(location);
    }

    @DeleteMapping("/{id}")
    public void deleteLocationById(@PathVariable Long id) {
        locationService.deleteById(id);
    }

    @GetMapping("/hierarchy/{id}")
    public List<Location> getLocationHierarchy(@PathVariable Long id) {
        return locationService.findLocationHierarchy(id);
    }

    @GetMapping("/root")
    public List<Location> getRootLocations() {
        return locationService.findRootLocations();
    }

    @GetMapping("/children/{parentId}")
    public List<Location> getChildrenByParentId(@PathVariable Long parentId) {
        return locationService.findChildrenByParentId(parentId);
    }

    @GetMapping("/descendants/{id}")
    public List<Location> getDescendants(@PathVariable Long id) {
        return locationService.getDescendants(id);
    }
}
