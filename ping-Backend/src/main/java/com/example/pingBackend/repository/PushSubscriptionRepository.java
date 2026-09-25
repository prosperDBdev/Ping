package com.example.pingBackend.repository;

import com.example.pingBackend.model.PushSubscription;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PushSubscriptionRepository extends MongoRepository<PushSubscription, String> {

    List<PushSubscription> findByUserId(String userId);

    List<PushSubscription> findByUserIdOrderByUpdatedAtDesc(String userId);

    void deleteByEndpoint(String endpoint);
}
