package com.example.pingBackend.repository;

import com.example.pingBackend.model.Task;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.Collection;
import java.util.List;

public interface TaskRepository extends MongoRepository<Task, String> {

    /** A conversation's tasks as one person sees them: shared ones, plus their own reminders. */
    @Query(value = "{ 'conversationId': ?0, $or: [ { 'personalReminder': false }, { 'createdBy': ?1 } ] }",
            sort = "{ 'createdAt': -1 }")
    List<Task> findVisible(String conversationId, String userId);

    /** The same rule across several conversations, for the Home page. */
    @Query(value = "{ 'conversationId': { $in: ?0 }, $or: [ { 'personalReminder': false }, { 'createdBy': ?1 } ] }",
            sort = "{ 'createdAt': -1 }")
    List<Task> findVisibleIn(Collection<String> conversationIds, String userId);
}
