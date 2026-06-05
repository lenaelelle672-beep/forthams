package com.ams.service;

import com.ams.entity.StocktakingCycle;
import com.ams.entity.StocktakingTask;

import java.util.List;

public interface StocktakingService {

    void startCycle(StocktakingCycle cycle);

    void assignTasks(Long cycleId, String abcFilter, String strategy);

    void pauseCycle(Long cycleId);

    void resumeCycle(Long cycleId);

    void completeCycle(Long cycleId);

    void adjustVariance(Long taskId, Integer threshold);

    List<StocktakingTask> getTasksByCycleId(Long cycleId);

    StocktakingTask getTaskById(Long taskId);
}