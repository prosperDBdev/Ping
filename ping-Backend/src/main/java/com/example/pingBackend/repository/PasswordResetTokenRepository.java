package com.example.pingBackend.repository;

import com.example.pingBackend.model.PasswordResetToken;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PasswordResetTokenRepository extends MongoRepository<PasswordResetToken, String> {

    /** Removes every outstanding reset link for a user — so only the newest one ever works. */
    void deleteByUserId(String userId);
}
