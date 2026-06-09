package com.ams.service;

import com.ams.entity.StocktakingCycle;
import com.ams.entity.StocktakingTask;
import com.ams.dto.StocktakingCycleStatsDTO;

import java.util.List;

public interface StocktakingService {

    List<StocktakingCycle> listCycles(String status);

    void startCycle(StocktakingCycle cycle);

    StocktakingCycle getCycleById(Long cycleId);

    StocktakingCycleStatsDTO getCycleStats(Long cycleId);

    void assignTasks(Long cycleId, String abcFilter, String strategy);

    void pauseCycle(Long cycleId);

    void resumeCycle(Long cycleId);

    void completeCycle(Long cycleId);

    void adjustVariance(Long taskId, Integer threshold);

    List<StocktakingTask> getTasksByCycleId(Long cycleId);

    StocktakingTask getTaskById(Long taskId);
}
