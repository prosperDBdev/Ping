package com.example.pingBackend.repository;

import com.example.pingBackend.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<User, String> {

    // Find a user by their exact username
    // Spring auto-generates: db.users.findOne({ username: "john" })
    Optional<User> findByUsername(String username);

    // Find a user by their exact email
    // Spring auto-generates: db.users.findOne({ email: "john@example.com" })
    Optional<User> findByEmail(String email);

    // Check if username already exists (for registration)
    // Spring auto-generates: db.users.count({ username: "john" }) > 0
    boolean existsByUsername(String username);

    // Check if email already exists (for registration)
    boolean existsByEmail(String email);

    /**
     * Does an account with this email exist, ignoring upper/lower case?
     *
     * Uses the SAME comparison rule (collation strength 2) as the unique index in
     * UserIndexConfig, so this check and the database's own rule can never disagree
     * about what counts as "the same email". ?0 is bound as a value, never pasted
     * into the query text, so nothing in an email can change what the query does.
     */
    @Query(value = "{ 'email': ?0 }", collation = "{ 'locale': 'en', 'strength': 2 }", exists = true)
    boolean existsByEmailIgnoringCase(String email);

    // Search users by partial username (for "find people to chat with")
    // "ohn" would find "john", "johnny", etc.
    // Spring auto-generates: db.users.find({ username: { $regex: "ohn", $options: "i" } })
    List<User> findByUsernameContainingIgnoreCase(String username);
}