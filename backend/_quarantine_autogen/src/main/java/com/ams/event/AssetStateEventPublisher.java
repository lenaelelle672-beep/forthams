package com.ams.event;

import com.ams.entity.AssetStatusChangedEvent;
import com.ams.state.AssetState;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * AssetStateEventPublisher publishes state change events for assets.
 * It is used by the asset state machine to notify listeners of transitions.
 */
@Component
public class AssetStateEventPublisher {

    private final ApplicationEventPublisher eventPublisher;

    public AssetStateEventPublisher(ApplicationEventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }

    /**
     * Publishes an asset status changed event.
     *
     * @param assetId   the unique identifier of the asset
     * @param fromState the previous state of the asset
     * @param toState   the new state of the asset
     */
    public void publishStatusChanged(String assetId, AssetState fromState, AssetState toState) {
        AssetStatusChangedEvent event = new AssetStatusChangedEvent(assetId, fromState, toState);
        eventPublisher.publishEvent(event);
    }
}