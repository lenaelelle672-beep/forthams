package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.Location;
import com.ams.service.LocationService;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/locations")
@RequiredArgsConstructor
public class LocationController {
    private final LocationService locationService;

    @PreAuthorize("@ss.hasPermi('location:query')")
    @GetMapping("/list")
    public Result<List<Location>> list() {
        return Result.success(locationService.findRootLocations());
    }

    @PreAuthorize("@ss.hasPermi('location:query')")
    @GetMapping("/tree")
    public Result<List<Location>> tree() {
        List<Location> roots = locationService.findRootLocations();
        buildTree(roots);
        return Result.success(roots);
    }

    private void buildTree(List<Location> nodes) {
        if (nodes == null) return;
        for (Location node : nodes) {
            List<Location> children = locationService.findChildrenByParentId(node.getId());
            if (children != null && !children.isEmpty()) {
                node.setChildren(children);
                buildTree(children);
            }
        }
    }

    /**
     * 级联查询：返回树形结构 [{code, name, children: [{code, name}...]}]
     */
    @PreAuthorize("@ss.hasPermi('location:query')")
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

    @PreAuthorize("@ss.hasPermi('location:query')")
    @GetMapping("/{id}")
    public Result<Location> getById(@PathVariable Long id) {
        return Result.success(locationService.findById(id));
    }

    @PreAuthorize("@ss.hasPermi('location:create')")
    @PostMapping
    public Result<Location> create(@Valid @RequestBody Location location) {
        locationService.insert(location);
        return Result.success(location);
    }

    @PreAuthorize("@ss.hasPermi('location:edit')")
    @PutMapping("/{id}")
    public Result<Location> update(@PathVariable Long id, @Valid @RequestBody Location location) {
        location.setId(id);
        locationService.update(location);
        return Result.success(location);
    }

    @PreAuthorize("@ss.hasPermi('location:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        locationService.deleteById(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('location:edit')")
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
