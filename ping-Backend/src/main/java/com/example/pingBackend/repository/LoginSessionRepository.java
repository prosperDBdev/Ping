package com.example.pingBackend.repository;

import com.example.pingBackend.model.LoginSession;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface LoginSessionRepository extends MongoRepository<LoginSession, String> {

    List<LoginSession> findByUserIdOrderByLastActiveAtDesc(String userId);
}
