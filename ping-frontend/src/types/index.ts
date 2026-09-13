export interface EchoMessage {
  content: string;
  timestamp: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  status: string;
  lastSeen: string | null;
  createdAt: string;
}

export interface LastMessage {
  content: string;
  senderId: string;
  senderUsername: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  type: string;
  participants: User[];
  name: string | null;
  admin?: string | null;
  description?: string | null;
  tagline?: string | null;
  lastMessage: LastMessage | null;
  unreadCount: number;
  // Server-owned now (previously a client-only badge): the backend sets these
  // when a temporary-chat invite is accepted, and filters expired ones out of
  // every listing itself.
  temporary: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemporaryChatInvite {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  durationMs: number;
  durationLabel: string;
  status: string;
  createdAt: string;
}

export interface TemporaryChatResponseEvent {
  inviteId: string;
  accepted: boolean;
  byUsername: string;
  conversation: Conversation | null;
}

export interface MessageAttachment {
  key: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  fileName: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  content: string;
  type: string;
  status: string;
  seenBy: string[];
  attachment: MessageAttachment | null;
  /** Present when this message was sent as a reply to a status. */
  statusReply?: StatusReply | null;
  createdAt: string;
}

export interface TypingEvent {
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface StatusEvent {
  userId: string;
  status: string;
  lastSeen?: string;
}

/**
 * Workspace layer types.
 *
 * The backend does not yet persist Tasks, Events, Pins or Temporary
 * Conversations — there is no corresponding Mongo collection or REST
 * endpoint for any of them. Until that exists, everything shaped below
 * is created and stored client-side (see `store/workspaceStore.ts`) so
 * the feature is fully usable today, and the shapes here double as the
 * contract a future `/api/conversations/{id}/tasks` etc. would return.
 */

export type TaskStatus = "TODO" | "IN_PROGRESS" | "COMPLETED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";
export type WorkspaceSection = "messages" | "tasks" | "files" | "events" | "pinned";

export interface TaskAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
}

export interface Task {
  id: string;
  conversationId: string;
  title: string;
  description: string;
  assigneeId: string | null;
  dueDate: string | null; // ISO date, no time component
  priority: TaskPriority;
  status: TaskStatus;
  attachments: TaskAttachment[];
  isReminder: boolean;
  sourceMessageId: string | null;
  sourceMessageSnippet: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  conversationId: string;
  title: string;
  description: string;
  date: string; // ISO date
  time: string | null; // "HH:mm"
  participantIds: string[];
  sourceMessageId: string | null;
  sourceMessageSnippet: string | null;
  createdBy: string;
  createdAt: string;
}

export interface PinnedItem {
  id: string;
  conversationId: string;
  messageId: string;
  messageSnippet: string;
  messageSenderUsername: string;
  pinnedBy: string;
  pinnedAt: string;
}

export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

/**
 * Conversation Memory — unlike Tasks/Events/Pins above, this one IS backed
 * by real endpoints (Stage 7: MemoryController + MemoryService), so it's
 * fetched from the server rather than kept in client-only local storage.
 */
export type MemoryCategory = "IMPORTANT" | "EVENT" | "FINANCIAL" | "LOCATION" | "PERSON" | "NOTE";

export interface Memory {
  id: string;
  conversationId: string;
  messageId: string;
  content: string;
  category: MemoryCategory;
  createdAt: string;
}
/**
 * Stage 10 — 24-hour statuses.
 *
 * `mediaKey` is an object key, deliberately not a URL: the bytes are served
 * through an authorised endpoint that re-checks visibility on every request,
 * so holding a key is not the same as being allowed to see the image.
 */
export type StatusType = "TEXT" | "IMAGE";

export interface Status {
  id: string;
  authorId: string;
  authorUsername: string;
  type: StatusType;
  text: string | null;
  backgroundColor: string | null;
  mediaKey: string | null;
  mediaMimeType: string | null;
  createdAt: string;
  expiresAt: string;
  viewed: boolean;
  /** Only populated for your own statuses — null when you're not the author. */
  viewerCount: number | null;
  resharedFromAuthorId: string | null;
  resharedFromAuthorUsername: string | null;
  reshareable: boolean;
  /** Your own reaction to this status, if you've left one. */
  myReaction: string | null;
  /** Author-only — null when you're not the author, like viewerCount. */
  reactionCount: number | null;
}

/**
 * The quote card on a message that replied to a status.
 *
 * A snapshot rather than a link: the status is gone after 24 hours, and the
 * reply is not, so this carries just enough to keep showing what was replied to.
 */
export interface StatusReply {
  statusId: string;
  statusAuthorId: string;
  statusType: StatusType | null;
  snippet: string;
  backgroundColor: string | null;
}

/** Someone who viewed your status, as only you — the author — can see. */
export interface StatusViewer {
  id: string;
  username: string;
  avatarUrl: string | null;
  reaction: string | null;
}

export interface StatusFeedEntry {
  authorId: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  statuses: Status[];
  latestAt: string;
  hasUnviewed: boolean;
}

export interface StatusPrivacy {
  hiddenStatusFrom: string[];
  allowResharing: boolean;
}
