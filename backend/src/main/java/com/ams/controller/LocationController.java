package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.Location;
import com.ams.service.LocationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.ArrayList;
import java.util.HashMap;
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

    /**
     * 级联查询：返回树形结构 [{code, name, children: [{code, name}...]}]
     */
    @GetMapping("/cascade")
    public Result<List<Map<String, Object>>> cascade() {
        List<Location> roots = locationService.findRootLocations();
        List<Map<String, Object>> tree = new ArrayList<>();
        for (Location root : roots) {
            tree.add(buildCascadeNode(root));
        }
        return Result.success(tree);
    }

    private Map<String, Object> buildCascadeNode(Location location) {
        Map<String, Object> node = new HashMap<>();
        node.put("code", location.getLocationCode() != null ? location.getLocationCode() : String.valueOf(location.getId()));
        node.put("name", location.getName() != null ? location.getName() : "");
        List<Location> children = locationService.findChildrenByParentId(location.getId());
        if (children != null && !children.isEmpty()) {
            List<Map<String, Object>> childNodes = new ArrayList<>();
            for (Location child : children) {
                childNodes.add(buildCascadeNode(child));
            }
            node.put("children", childNodes);
        }
        return node;
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
