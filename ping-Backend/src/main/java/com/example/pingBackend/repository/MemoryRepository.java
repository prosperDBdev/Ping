package com.example.pingBackend.repository;

import com.example.pingBackend.model.Memory;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

/**
 * Simple derived-query methods live here as usual. The combined
 * category + free-text search (optional filters, either of which might be
 * absent on a given request) doesn't fit that style cleanly — that one's
 * built with MongoTemplate directly in MemoryService, since a derived method
 * name can't express "filter by this AND optionally by that AND optionally
 * by this other thing" without an explosion of method-name variants.
 */
@Repository
public interface MemoryRepository extends MongoRepository<Memory, String> {
}
