package com.example.pingBackend.dto.request;

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
 * NOTE ON VALIDATION — I've deliberately left the annotations off.
 *
 * @NotBlank, @Size, @NotEmpty would go on these two fields, and adding them is
 * a one-line change each. But the values they'd carry are decisions from the
 * brief, not boilerplate: is a name required, how long may it be, what is the
 * smallest number of people that still constitutes a group, and what is the
 * largest you're willing to pay for on a free tier. Those are yours to make,
 * so I've left the fields bare rather than quietly answering them for you.
 *
 * Two things to know when you do add them:
 *
 *   - The annotations do NOTHING on their own. They only run because the
 *     controller parameter is marked @Valid — see how createPrivateConversation
 *     does it. An annotated DTO with no @Valid is a very convincing-looking
 *     no-op, and it's a classic way to ship an endpoint that accepts anything.
 *
 *   - Bean validation can only check the SHAPE of what arrived: not blank, not
 *     empty, within a length. It cannot tell you whether these ids belong to
 *     real users, whether one of them has blocked you, or whether the list
 *     contains the same person twice. Those need the database and the blocking
 *     rule, so they belong in the service. Don't let a tidy set of annotations
 *     convince you the input is safe.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateGroupRequest {

    /** Display name for the group. Untrusted text — render it, never interpret it. */
    private String name;

    /**
     * The OTHER members, as the client sees it.
     *
     * The frontend sends everyone the creator picked and does not include the
     * creator themselves. Whether the creator ends up in the saved
     * `participants` list is a decision this DTO deliberately does not make —
     * it just reports what was sent.
     */
    private List<String> participantIds;
}
