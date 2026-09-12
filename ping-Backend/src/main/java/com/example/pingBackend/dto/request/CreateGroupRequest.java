package com.example.pingBackend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Body for creating a group conversation.
 *
 * Kept separate from CreateConversationRequest rather than adding fields to it.
 * That class carries exactly one participant and is what a private chat needs;
 * merging the two would give both endpoints a DTO where half the fields are
 * meaningless and the reader has to know which half applies to them.
 *
 * WHAT THIS OBJECT IS — worth being precise about, because it's the difference
 * between a 400 and a security hole:
 *
 * It is a bag of values a client sent. Nothing here has been checked. The names
 * of the fields describe what the client CLAIMS, not what is true. In
 * particular, `participantIds` is a list of strings the browser chose — there
 * is no guarantee they are real users, that they aren't duplicated, that the
 * caller hasn't included themselves, or that the caller is allowed to add any
 * of them. Every one of those is the service's job to establish.
 *
 * ON THE VALIDATION BELOW — two things worth knowing.
 *
 * The annotations do NOTHING on their own. They only run because the controller
 * parameter is marked @Valid. An annotated DTO with no @Valid is a very
 * convincing-looking no-op, and a classic way to ship an endpoint that accepts
 * absolutely anything.
 *
 * And they can only check the SHAPE of what arrived: not blank, not empty,
 * within a length or a count. They cannot tell you whether these ids belong to
 * real users, whether one of them has blocked you, or whether the list names
 * the same person twice. Those need the database and the blocking rule, so they
 * live in the service. A tidy row of annotations is not the same as safe input.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateGroupRequest {

    /**
     * Display name for the group. Untrusted text — render it, never interpret it.
     *
     * Required, because a group is a place people return to and an unnamed one
     * is unfindable in a sidebar. Capped at 60 characters: long enough for a
     * real name, short enough that it can't be used to push a wall of text into
     * every member's conversation list.
     */
    @NotBlank(message = "Give the group a name")
    @Size(max = 60, message = "Group name can be at most 60 characters")
    private String name;

    /**
     * The OTHER members, as the client sees it.
     *
     * The frontend sends everyone the creator picked and does not include the
     * creator themselves. Whether the creator ends up in the saved
     * `participants` list is decided in the service, not here — this field only
     * reports what was sent.
     *
     * At least one, so the smallest possible group is two people. A "group" of
     * one is just a note to self, and nothing here supports that.
     *
     * At most 49, giving 50 members including the creator. That ceiling is a
     * cost decision, not a product one: the Conversation document carries an
     * unreadCount entry and potentially a clearedAt entry PER MEMBER, and both
     * maps live inside the single document that every message write updates.
     * Unbounded membership means an unbounded document on a 512MB free tier.
     */
    @NotEmpty(message = "A group needs at least one other person")
    @Size(max = 49, message = "A group can have at most 50 members including you")
    private List<String> participantIds;
}
