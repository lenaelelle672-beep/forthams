package com.ams.service;

import com.ams.entity.Location;
import com.ams.mapper.LocationMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class LocationService {

    @Autowired
    private LocationMapper locationMapper;

    public Location findById(Long id) {
        return locationMapper.findById(id);
    }

    public void insert(Location location) {
        locationMapper.insert(location);
    }

    public void update(Location location) {
        locationMapper.update(location);
    }

    public void deleteById(Long id) {
        locationMapper.deleteById(id);
    }

    public List<Location> getLocationHierarchy(Long id) {
        return locationMapper.findLocationHierarchy(id);
    }

    public List<Location> getRootLocations() {
        return locationMapper.findRootLocations();
    }

    public List<Location> getChildrenByParentId(Long parentId) {
        return locationMapper.findChildrenByParentId(parentId);
    }

    public List<Location> getDescendants(Long id) {
        return locationMapper.findDescendants(id);
    }
}
