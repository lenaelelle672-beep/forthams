package com.ams.controller;

import com.ams.entity.Location;
import com.ams.service.LocationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/locations")
public class LocationController {

    @Autowired
    private LocationService locationService;

    @GetMapping("/{id}")
    public Location getLocationById(@PathVariable Long id) {
        return locationService.findById(id);
    }

    @PostMapping("/")
    public void createLocation(@RequestBody Location location) {
        locationService.insert(location);
    }

    @PutMapping("/{id}")
    public void updateLocation(@PathVariable Long id, @RequestBody Location location) {
        location.setId(id);
        locationService.update(location);
    }

    @DeleteMapping("/{id}")
    public void deleteLocation(@PathVariable Long id) {
        locationService.deleteById(id);
    }

    @GetMapping("/roots")
    public List<Location> getRootLocations() {
        return locationService.findRootLocations();
    }

    @GetMapping("/children/{parentId}")
    public List<Location> getChildrenByParentId(@PathVariable Long parentId) {
        return locationService.findChildrenByParentId(parentId);
    }
}
