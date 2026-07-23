package com.ams.service;

import com.ams.entity.Location;
import com.ams.mapper.LocationMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class LocationService {

    @Autowired
    private LocationMapper locationMapper;

    public Location findById(Long id) {
        return locationMapper.findById(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public void insert(Location location) {
        locationMapper.insert(location);
    }

    @Transactional(rollbackFor = Exception.class)
    public void update(Location location) {
        locationMapper.update(location);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteById(Long id) {
        locationMapper.deleteById(id);
    }

    public List<Location> findLocationHierarchy(Long id) {
        return locationMapper.findLocationHierarchy(id);
    }

    public List<Location> findRootLocations() {
        return locationMapper.findRootLocations();
    }

    public List<Location> findChildrenByParentId(Long parentId) {
        return locationMapper.findChildrenByParentId(parentId);
    }

    public List<Location> findDescendants(Long id) {
        return locationMapper.findDescendants(id);
    }
}
