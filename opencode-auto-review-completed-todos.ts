import type { Plugin } from "@opencode-ai/plugin";

// --- Configuration ---

interface AutoReviewConfig {
  levenshteinThreshold: number;
  reviewPrompt: string;
  bulkPhrases: string[];
  debounceMs: number;
}

const DEFAULT_OPTIONS: AutoReviewConfig = {
  levenshteinThreshold: 3,
  reviewPrompt:
    "All tasks in this session have been completed. Please perform a final review: summarize what was accomplished, note any technical decisions or trade-offs made, flag anything that should be documented, and list any follow-up tasks or improvements for next time.",
  bulkPhrases: [
    "all todos done",
    "all tasks completed",
    "all done",
    "all tasks done",
    "all wrapped up",
    "everything done",
    "everything completed",
  ],
  debounceMs: 500,
};

// --- Types ---

interface SessionState {
  todos: Set<string>;
  reviewFired: boolean;
  hadTodos: boolean;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  textSources: Map<string, string>;
  sourceTodos: Map<string, string[]>;
  messageParts: Map<string, Set<string>>;
}

// --- Regex Patterns ---

const TODO_CREATION_PATTERNS = [
  /^\s*- \[ \]\s+(.+)$/gim,
  /^\s*\[ \]\s+(.+)$/gim,
  /\bTODO:\s*(.+?)(?:\n|$)/gim,
  /\btodo:\s*(.+?)(?:\n|$)/gim,
  /\btodo\s+(\S.+?)(?:\n|$)/gim,
];

const TODO_COMPLETION_PATTERNS = [
  /^\s*- \[x\]\s+(.+)$/gim,
  /^\s*\[x\]\s+(.+)$/gim,
  /\bDONE:\s*(.+?)(?:\n|$)/gim,
  /\bdone:\s*(.+?)(?:\n|$)/gim,
  /\bcompleted:\s*(.+?)(?:\n|$)/gim,
  /\bfixed:\s*(.+?)(?:\n|$)/gim,
  /\bresolved:\s*(.+?)(?:\n|$)/gim,
];

// --- Levenshtein Distance ---

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev: number[] = new Array(n + 1);
  let curr: number[] = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

function normalizeTask(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function findMatchingTodo(
  taskText: string,
  todos: Set<string>,
  threshold: number
): string | null {
  const normalized = normalizeTask(taskText);

  for (const todo of todos) {
    const todoNorm = normalizeTask(todo);
    if (todoNorm.includes(normalized) || normalized.includes(todoNorm)) {
      return todo;
    }
    const dynamicThreshold = Math.min(
      threshold,
      Math.max(todoNorm.length, normalized.length) > 5 ? threshold : Math.max(1, threshold - 1)
    );
    if (levenshtein(todoNorm, normalized) <= dynamicThreshold) {
      return todo;
    }
  }

  return null;
}

function isDuplicateTodo(taskText: string, todos: Set<string>): boolean {
  const normalized = normalizeTask(taskText);
  for (const todo of todos) {
    if (normalizeTask(todo) === normalized) return true;
    if (levenshtein(normalizeTask(todo), normalized) <= 1) return true;
  }
  return false;
}

function findMatchingBulkPhrase(text: string, phrases: string[]): string | null {
  const normalizedText = normalizeTask(text);
  for (const phrase of phrases) {
    const normalizedPhrase = normalizeTask(phrase);
    if (normalizedText.includes(normalizedPhrase)) {
      return phrase;
    }
    const sentences = normalizedText.split(/[.!?]+/);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length === 0) continue;
      if (trimmed.includes(normalizedPhrase)) {
        return phrase;
      }
      if (levenshtein(trimmed, normalizedPhrase) <= 2) {
        return phrase;
      }
    }
  }
  return null;
}

function extractTodos(text: string): string[] {
  const todos: string[] = [];
  for (const pattern of TODO_CREATION_PATTERNS) {
    let match: RegExpExecArray | null;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const task = match[1].trim();
      if (task) todos.push(task);
    }
  }
  if (todos.length > 0) trace(`extractTodos found: ${JSON.stringify(todos)}`);
  return todos;
}

// --- Plugin ---

export const AutoReviewCompletedTodosPlugin: Plugin = async (input, options) => {
  log("info", "AutoReviewCompletedTodosPlugin loaded");

  const rawOptions =
    typeof options === "object" && options !== null
      ? (options as Partial<AutoReviewConfig>)
      : {};

  const config: AutoReviewConfig = {
    levenshteinThreshold: Math.max(
      0,
      Math.min(10, rawOptions.levenshteinThreshold ?? DEFAULT_OPTIONS.levenshteinThreshold)
    ),
    reviewPrompt:
      typeof rawOptions.reviewPrompt === "string" && rawOptions.reviewPrompt.trim().length > 0
        ? rawOptions.reviewPrompt
        : DEFAULT_OPTIONS.reviewPrompt,
    bulkPhrases: Array.isArray(rawOptions.bulkPhrases)
      ? rawOptions.bulkPhrases.filter((p): p is string => typeof p === "string" && p.length > 0)
      : DEFAULT_OPTIONS.bulkPhrases,
    debounceMs: Math.max(0, Math.min(30000, rawOptions.debounceMs ?? DEFAULT_OPTIONS.debounceMs)),
  };

  const log = (level: "info" | "error", message: string) => {
    if (typeof input.client.app?.log === "function") {
      input.client.app.log({
        body: { service: "auto-review", level, message },
      });
    } else {
      const fn = level === "error" ? console.error : console.log;
      fn(`[auto-review] ${message}`);
    }
  };

  const trace = (msg: string) => console.error(`[auto-review] ${msg}`);

  log("info", "AutoReviewCompletedTodosPlugin loaded");
  trace("PLUGIN LOADED");

  const sessions = new Map<string, SessionState>();

  function getSession(id: string): SessionState | undefined {
    return sessions.get(id);
  }

  function ensureSession(id: string): SessionState {
    if (!sessions.has(id)) {
      sessions.set(id, {
        todos: new Set(),
        reviewFired: false,
        hadTodos: false,
        debounceTimer: null,
        textSources: new Map(),
        sourceTodos: new Map(),
        messageParts: new Map(),
      });
    }
    return sessions.get(id)!;
  }

  function cleanupSession(id: string) {
    const state = sessions.get(id);
    if (state?.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }
    sessions.delete(id);
    log("info", `Cleaned up session ${id}`);
  }

  async function triggerReview(sessionId: string) {
    const state = sessions.get(sessionId);
    if (!state || state.reviewFired) return;

    state.reviewFired = true;
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = null;
    }

    log("info", `Review triggered for session ${sessionId}`);
    trace(`TRIGGER REVIEW for ${sessionId}`);

    try {
      await input.client.session.prompt({
        body: {
          parts: [{ type: "text", text: config.reviewPrompt }],
          noReply: true,
        },
        path: { id: sessionId },
      });
    } catch (err) {
      log("error", `Failed to inject review prompt: ${err}`);
    }
  }

  function scheduleReview(sessionId: string) {
    const state = sessions.get(sessionId);
    if (!state || state.reviewFired) return;

    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }

    trace(`SCHEDULE REVIEW in ${config.debounceMs}ms for ${sessionId} (todos=${state.todos.size}, had=${state.hadTodos})`);

    state.debounceTimer = setTimeout(() => {
      trace(`DEBOUNCE FIRED for ${sessionId} (todos=${state.todos.size}, fired=${state.reviewFired}, had=${state.hadTodos})`);
      if (state.todos.size === 0 && !state.reviewFired && state.hadTodos) {
        triggerReview(sessionId);
      }
      state.debounceTimer = null;
    }, config.debounceMs);
  }

  function extractTextFromEvent(event: any): string {
    const rootDelta = event?.properties?.delta;
    if (rootDelta?.text && typeof rootDelta.text === "string") {
      return rootDelta.text;
    }

    const partDelta = event?.properties?.part?.delta;
    if (partDelta?.text && typeof partDelta.text === "string") {
      return partDelta.text;
    }

    const parts =
      event?.properties?.parts ??
      event?.properties?.message?.parts ??
      [];

    if (!Array.isArray(parts)) {
      const singlePart = event?.properties?.part ?? event?.properties?.message?.part;
      if (singlePart?.type === "text" && typeof singlePart.text === "string") {
        return singlePart.text;
      }
      if (singlePart?.delta?.text && typeof singlePart.delta.text === "string") {
        return singlePart.delta.text;
      }
      return "";
    }

    return parts
      .map((p: any) => {
        if (p?.type === "text" && typeof p.text === "string") {
          return p.text;
        }
        if (p?.delta?.text && typeof p.delta.text === "string") {
          return p.delta.text;
        }
        return "";
      })
      .filter((t: string) => t.length > 0)
      .join("\n");
  }

  function getPartId(event: any): string | undefined {
    return (
      event?.properties?.part?.id ??
      event?.properties?.partID ??
      event?.properties?.part?.partID
    );
  }

  function getMessageId(event: any): string | undefined {
    return event?.properties?.messageID ?? event?.properties?.message?.id;
  }

  function getSourceKey(event: any): string {
    const partId = getPartId(event);
    if (partId) return `part:${partId}`;

    const msgId = getMessageId(event);
    if (msgId) return `msg:${msgId}`;

    return `orphan:${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function getSourceKeyForPartId(partId: string): string {
    return `part:${partId}`;
  }

  function getSourceKeyForMessageId(messageId: string): string {
    return `msg:${messageId}`;
  }

  function todoExistsInOtherSources(state: SessionState, sourceKey: string, todo: string): boolean {
    for (const [key, todos] of state.sourceTodos) {
      if (key !== sourceKey && todos.includes(todo)) {
        return true;
      }
    }
    return false;
  }

  function applySourceDiff(state: SessionState, sourceKey: string, newTodos: string[]) {
    const oldTodos = state.sourceTodos.get(sourceKey) || [];

    // Remove todos that disappeared from this source (and don't exist elsewhere)
    for (const oldTodo of oldTodos) {
      if (!newTodos.includes(oldTodo) && !todoExistsInOtherSources(state, sourceKey, oldTodo)) {
        state.todos.delete(oldTodo);
        trace(`REMOVED from source ${sourceKey}: "${oldTodo}"`);
      }
    }

    // Add new todos from this source
    for (const newTodo of newTodos) {
      if (!isDuplicateTodo(newTodo, state.todos)) {
        state.todos.add(newTodo);
        trace(`REGISTERED: "${newTodo}" (source: ${sourceKey})`);
      }
    }

    if (newTodos.length > 0 || state.todos.size > 0) {
      state.hadTodos = true;
    }

    state.sourceTodos.set(sourceKey, newTodos);
    trace(`STATE: ${state.todos.size} todos, hadTodos=${state.hadTodos}`);
  }

  function removeSource(state: SessionState, sourceKey: string) {
    const oldTodos = state.sourceTodos.get(sourceKey) || [];

    for (const oldTodo of oldTodos) {
      if (!todoExistsInOtherSources(state, sourceKey, oldTodo)) {
        state.todos.delete(oldTodo);
      }
    }

    state.textSources.delete(sourceKey);
    state.sourceTodos.delete(sourceKey);
  }

  function detectAndCompleteTodos(text: string, sessionId: string) {
    const state = getSession(sessionId);
    if (!state || state.todos.size === 0) {
      trace(`detectAndCompleteTodos: no active todos for ${sessionId}`);
      return;
    }
    trace(`detectAndCompleteTodos checking text: "${text.slice(0, 80)}" for ${state.todos.size} todos`);

    for (const pattern of TODO_COMPLETION_PATTERNS) {
      let match: RegExpExecArray | null;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        const task = match[1].trim();
        if (!task) continue;

        const matchedTodo = findMatchingTodo(task, state.todos, config.levenshteinThreshold);
        if (matchedTodo) {
          state.todos.delete(matchedTodo);
          trace(`COMPLETED: "${matchedTodo}" (matched: "${task}")`);
        }
      }
    }

    const matchedPhrase = findMatchingBulkPhrase(text, config.bulkPhrases);
    if (matchedPhrase) {
      trace(`BULK COMPLETE: "${matchedPhrase}" - clearing ${state.todos.size} todos`);
      state.todos.clear();
      state.textSources.clear();
      state.sourceTodos.clear();
      state.messageParts.clear();
      return;
    }
  }

  function checkAndScheduleReview(sessionId: string) {
    const state = getSession(sessionId);
    if (state && state.todos.size === 0 && !state.reviewFired && state.hadTodos) {
      log("info", `Scheduling review for ${sessionId} (todos: 0, hadTodos: true)`);
      scheduleReview(sessionId);
    } else if (state) {
      log("info", `Review not scheduled: todos=${state.todos.size}, fired=${state.reviewFired}, had=${state.hadTodos}`);
    }
  }

  function processSourceUpdate(sessionId: string, sourceKey: string, text: string) {
    const state = ensureSession(sessionId);
    const newTodos = extractTodos(text);
    state.textSources.set(sourceKey, text);
    applySourceDiff(state, sourceKey, newTodos);
  }

  return {
    event: async ({ event }: { event: any }) => {
      const e = event as any;
      const eventType = event?.type || "unknown";
      
      let sessionId =
        e?.properties?.sessionID ??
        e?.properties?.part?.sessionID;

      if (!sessionId) {
        const msgId = getMessageId(e);
        if (msgId) {
          sessionId = `_msg_${msgId}`;
        } else {
          sessionId = `_orphan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        }
      }

      log("info", `Event: ${eventType} | session: ${sessionId}`);
      trace(`EVENT: ${eventType} | SESSION: ${sessionId}`);

      // Session lifecycle
      if (event?.type === "session.created") {
        cleanupSession(sessionId);
        return;
      }

      if (event?.type === "session.error") {
        cleanupSession(sessionId);
        return;
      }

      if (event?.type === "session.compacted") {
        cleanupSession(sessionId);
        return;
      }

      if (event?.type === "session.ended" || event?.type === "session.deleted") {
        cleanupSession(sessionId);
        return;
      }

      // Idle safety net
      if (event?.type === "session.idle") {
        const state = getSession(sessionId);
        if (state && state.todos.size === 0 && !state.reviewFired && state.hadTodos) {
          if (state.debounceTimer) {
            clearTimeout(state.debounceTimer);
            state.debounceTimer = null;
          }
          await triggerReview(sessionId);
        }
        return;
      }

      // Message removed: clean up message source and all its tracked parts
      if (event?.type === "message.removed") {
        const msgId = getMessageId(e);
        if (msgId) {
          const state = getSession(sessionId);
          if (state) {
            const partIds = state.messageParts.get(msgId);
            if (partIds) {
              for (const partId of partIds) {
                removeSource(state, getSourceKeyForPartId(partId));
              }
              state.messageParts.delete(msgId);
            }
            removeSource(state, getSourceKeyForMessageId(msgId));
            checkAndScheduleReview(sessionId);
          }
        }
        return;
      }

      // Part removed: clean up that specific part source
      if (event?.type === "message.part.removed") {
        const partId = getPartId(e);
        if (partId) {
          const state = getSession(sessionId);
          if (state) {
            removeSource(state, getSourceKeyForPartId(partId));
            checkAndScheduleReview(sessionId);
          }
        }
        return;
      }

      // All other message events
      const messageEventTypes = [
        "message.created",
        "message.part.delta",
        "message.part.updated",
        "message.part.added",
        "message.updated",
      ];

      if (!messageEventTypes.includes(event?.type)) {
        return;
      }

      const text = extractTextFromEvent(e);
      if (!text) return;

      const sourceKey = getSourceKey(e);
      const partId = getPartId(e);
      const msgId = getMessageId(e);

      // Track which parts belong to which messages
      if (partId && msgId) {
        const state = ensureSession(sessionId);
        const parts = state.messageParts.get(msgId) || new Set();
        parts.add(partId);
        state.messageParts.set(msgId, parts);
      }

      // Delta events accumulate text
      if (event?.type === "message.part.delta") {
        const state = ensureSession(sessionId);
        const accumulated = (state.textSources.get(sourceKey) || "") + text;
        processSourceUpdate(sessionId, sourceKey, accumulated);
        detectAndCompleteTodos(accumulated, sessionId);  // FIX: use accumulated, not raw
        checkAndScheduleReview(sessionId);
        return;
      }

      // All other events replace text
      processSourceUpdate(sessionId, sourceKey, text);
      detectAndCompleteTodos(text, sessionId);
      checkAndScheduleReview(sessionId);
    },
  };
};
