// @bun
// opencode-auto-review-completed-todos.ts
var DEFAULT_OPTIONS = {
  debug: false,
  levenshteinThreshold: 3,
  reviewPrompt: "All tasks in this session have been completed. Please perform a final review: summarize what was accomplished, note any technical decisions or trade-offs made, flag anything that should be documented, and list any follow-up tasks or improvements for next time.",
  bulkPhrases: [
    "all todos done",
    "all tasks completed",
    "all done",
    "all tasks done",
    "all wrapped up",
    "everything done",
    "everything completed"
  ],
  debounceMs: 500
};
var TODO_CREATION_PATTERNS = [
  /^\s*- \[ \]\s+(.+)$/gim,
  /^\s*\[ \]\s+(.+)$/gim,
  /\bTODO:\s*(.+?)(?:\n|$)/gim,
  /\btodo:\s*(.+?)(?:\n|$)/gim,
  /\btodo\s+(\S.+?)(?:\n|$)/gim
];
var TODO_COMPLETION_PATTERNS = [
  /^\s*- \[x\]\s+(.+)$/gim,
  /^\s*\[x\]\s+(.+)$/gim,
  /\bDONE:\s*(.+?)(?:\n|$)/gim,
  /\bdone:\s*(.+?)(?:\n|$)/gim,
  /\bcompleted:\s*(.+?)(?:\n|$)/gim,
  /\bfixed:\s*(.+?)(?:\n|$)/gim,
  /\bresolved:\s*(.+?)(?:\n|$)/gim
];
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0)
    return n;
  if (n === 0)
    return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0;j <= n; j++)
    prev[j] = j;
  for (let i = 1;i <= m; i++) {
    curr[0] = i;
    for (let j = 1;j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
function normalizeTask(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}
function findMatchingTodo(taskText, todos, threshold) {
  const normalized = normalizeTask(taskText);
  for (const todo of todos) {
    const todoNorm = normalizeTask(todo);
    if (todoNorm.includes(normalized) || normalized.includes(todoNorm)) {
      return todo;
    }
    const dynamicThreshold = Math.min(threshold, Math.max(todoNorm.length, normalized.length) > 5 ? threshold : Math.max(1, threshold - 1));
    if (levenshtein(todoNorm, normalized) <= dynamicThreshold) {
      return todo;
    }
  }
  return null;
}
function isDuplicateTodo(taskText, todos) {
  const normalized = normalizeTask(taskText);
  for (const todo of todos) {
    if (normalizeTask(todo) === normalized)
      return true;
    if (levenshtein(normalizeTask(todo), normalized) <= 1)
      return true;
  }
  return false;
}
function findMatchingBulkPhrase(text, phrases) {
  const normalizedText = normalizeTask(text);
  for (const phrase of phrases) {
    const normalizedPhrase = normalizeTask(phrase);
    if (normalizedText.includes(normalizedPhrase)) {
      return phrase;
    }
    const sentences = normalizedText.split(/[.!?]+/);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length === 0)
        continue;
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
function extractTodos(text) {
  const todos = [];
  for (const pattern of TODO_CREATION_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const task = match[1].trim();
      if (task)
        todos.push(task);
    }
  }
  return todos;
}
var AutoReviewCompletedTodosPlugin = async (input, options) => {
  log("info", "AutoReviewCompletedTodosPlugin loaded");
  const rawOptions = typeof options === "object" && options !== null ? options : {};
  const config = {
    levenshteinThreshold: Math.max(0, Math.min(10, rawOptions.levenshteinThreshold ?? DEFAULT_OPTIONS.levenshteinThreshold)),
    reviewPrompt: typeof rawOptions.reviewPrompt === "string" && rawOptions.reviewPrompt.trim().length > 0 ? rawOptions.reviewPrompt : DEFAULT_OPTIONS.reviewPrompt,
    bulkPhrases: Array.isArray(rawOptions.bulkPhrases) ? rawOptions.bulkPhrases.filter((p) => typeof p === "string" && p.length > 0) : DEFAULT_OPTIONS.bulkPhrases,
    debounceMs: Math.max(0, Math.min(30000, rawOptions.debounceMs ?? DEFAULT_OPTIONS.debounceMs))
  };
  const log = (level, message) => {
    if (typeof input.client.app?.log === "function") {
      input.client.app.log({
        body: { service: "auto-review", level, message }
      });
    } else {
      const fn = level === "error" ? console.error : console.log;
      fn(`[auto-review] ${message}`);
    }
  };
  log("info", "AutoReviewCompletedTodosPlugin loaded");
  const sessions = new Map;
  function getSession(id) {
    return sessions.get(id);
  }
  function ensureSession(id) {
    if (!sessions.has(id)) {
      sessions.set(id, {
        todos: new Set,
        reviewFired: false,
        hadTodos: false,
        debounceTimer: null,
        textSources: new Map,
        sourceTodos: new Map,
        messageParts: new Map
      });
    }
    return sessions.get(id);
  }
  function cleanupSession(id) {
    const state = sessions.get(id);
    if (state?.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }
    sessions.delete(id);
    log("info", `Cleaned up session ${id}`);
  }
  async function triggerReview(sessionId) {
    const state = sessions.get(sessionId);
    if (!state || state.reviewFired)
      return;
    state.reviewFired = true;
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = null;
    }
    log("info", `Review triggered for session ${sessionId}`);
    try {
      await input.client.session.prompt({
        body: {
          parts: [{ type: "text", text: config.reviewPrompt }],
          noReply: true
        },
        path: { id: sessionId }
      });
    } catch (err) {
      log("error", `Failed to inject review prompt: ${err}`);
    }
  }
  function scheduleReview(sessionId) {
    const state = sessions.get(sessionId);
    if (!state || state.reviewFired)
      return;
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }
    state.debounceTimer = setTimeout(() => {
      if (state.todos.size === 0 && !state.reviewFired && state.hadTodos) {
        triggerReview(sessionId);
      }
      state.debounceTimer = null;
    }, config.debounceMs);
  }
  function extractTextFromEvent(event) {
    const rootDelta = event?.properties?.delta;
    if (rootDelta?.text && typeof rootDelta.text === "string") {
      return rootDelta.text;
    }
    const partDelta = event?.properties?.part?.delta;
    if (partDelta?.text && typeof partDelta.text === "string") {
      return partDelta.text;
    }
    const parts = event?.properties?.parts ?? event?.properties?.message?.parts ?? [];
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
    return parts.map((p) => {
      if (p?.type === "text" && typeof p.text === "string") {
        return p.text;
      }
      if (p?.delta?.text && typeof p.delta.text === "string") {
        return p.delta.text;
      }
      return "";
    }).filter((t) => t.length > 0).join(`
`);
  }
  function getPartId(event) {
    return event?.properties?.part?.id ?? event?.properties?.partID ?? event?.properties?.part?.partID;
  }
  function getMessageId(event) {
    return event?.properties?.messageID ?? event?.properties?.message?.id;
  }
  function getSourceKey(event) {
    const partId = getPartId(event);
    if (partId)
      return `part:${partId}`;
    const msgId = getMessageId(event);
    if (msgId)
      return `msg:${msgId}`;
    return `orphan:${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }
  function getSourceKeyForPartId(partId) {
    return `part:${partId}`;
  }
  function getSourceKeyForMessageId(messageId) {
    return `msg:${messageId}`;
  }
  function todoExistsInOtherSources(state, sourceKey, todo) {
    for (const [key, todos] of state.sourceTodos) {
      if (key !== sourceKey && todos.includes(todo)) {
        return true;
      }
    }
    return false;
  }
  function applySourceDiff(state, sourceKey, newTodos) {
    const oldTodos = state.sourceTodos.get(sourceKey) || [];
    for (const oldTodo of oldTodos) {
      if (!newTodos.includes(oldTodo) && !todoExistsInOtherSources(state, sourceKey, oldTodo)) {
        state.todos.delete(oldTodo);
      }
    }
    for (const newTodo of newTodos) {
      if (!isDuplicateTodo(newTodo, state.todos)) {
        state.todos.add(newTodo);
        log("info", `Todo registered: "${newTodo}"`);
      }
    }
    if (newTodos.length > 0 || state.todos.size > 0) {
      state.hadTodos = true;
    }
    state.sourceTodos.set(sourceKey, newTodos);
  }
  function removeSource(state, sourceKey) {
    const oldTodos = state.sourceTodos.get(sourceKey) || [];
    for (const oldTodo of oldTodos) {
      if (!todoExistsInOtherSources(state, sourceKey, oldTodo)) {
        state.todos.delete(oldTodo);
      }
    }
    state.textSources.delete(sourceKey);
    state.sourceTodos.delete(sourceKey);
  }
  function detectAndCompleteTodos(text, sessionId) {
    const state = getSession(sessionId);
    if (!state || state.todos.size === 0)
      return;
    for (const pattern of TODO_COMPLETION_PATTERNS) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        const task = match[1].trim();
        if (!task)
          continue;
        const matchedTodo = findMatchingTodo(task, state.todos, config.levenshteinThreshold);
        if (matchedTodo) {
          state.todos.delete(matchedTodo);
          log("info", `Todo completed: "${matchedTodo}"`);
        }
      }
    }
    const matchedPhrase = findMatchingBulkPhrase(text, config.bulkPhrases);
    if (matchedPhrase) {
      log("info", `Bulk completion detected: "${matchedPhrase}"`);
      state.todos.clear();
      state.textSources.clear();
      state.sourceTodos.clear();
      state.messageParts.clear();
      return;
    }
  }
  function checkAndScheduleReview(sessionId) {
    const state = getSession(sessionId);
    if (state && state.todos.size === 0 && !state.reviewFired && state.hadTodos) {
      log("info", `Scheduling review for ${sessionId} (todos: 0, hadTodos: true)`);
      scheduleReview(sessionId);
    } else if (state) {
      log("info", `Review not scheduled: todos=${state.todos.size}, fired=${state.reviewFired}, had=${state.hadTodos}`);
    }
  }
  function processSourceUpdate(sessionId, sourceKey, text) {
    const state = ensureSession(sessionId);
    const newTodos = extractTodos(text);
    state.textSources.set(sourceKey, text);
    applySourceDiff(state, sourceKey, newTodos);
  }
  return {
    event: async ({ event }) => {
      const e = event;
      const eventType = event?.type || "unknown";
      let sessionId = e?.properties?.sessionID ?? e?.properties?.part?.sessionID;
      if (!sessionId) {
        const msgId2 = getMessageId(e);
        if (msgId2) {
          sessionId = `_msg_${msgId2}`;
        } else {
          sessionId = `_orphan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        }
      }
      log("info", `Event: ${eventType} | session: ${sessionId}`);
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
      if (event?.type === "message.removed") {
        const msgId2 = getMessageId(e);
        if (msgId2) {
          const state = getSession(sessionId);
          if (state) {
            const partIds = state.messageParts.get(msgId2);
            if (partIds) {
              for (const partId2 of partIds) {
                removeSource(state, getSourceKeyForPartId(partId2));
              }
              state.messageParts.delete(msgId2);
            }
            removeSource(state, getSourceKeyForMessageId(msgId2));
            checkAndScheduleReview(sessionId);
          }
        }
        return;
      }
      if (event?.type === "message.part.removed") {
        const partId2 = getPartId(e);
        if (partId2) {
          const state = getSession(sessionId);
          if (state) {
            removeSource(state, getSourceKeyForPartId(partId2));
            checkAndScheduleReview(sessionId);
          }
        }
        return;
      }
      const messageEventTypes = [
        "message.created",
        "message.part.delta",
        "message.part.updated",
        "message.part.added",
        "message.updated"
      ];
      if (!messageEventTypes.includes(event?.type)) {
        return;
      }
      const text = extractTextFromEvent(e);
      if (!text)
        return;
      const sourceKey = getSourceKey(e);
      const partId = getPartId(e);
      const msgId = getMessageId(e);
      if (partId && msgId) {
        const state = ensureSession(sessionId);
        const parts = state.messageParts.get(msgId) || new Set;
        parts.add(partId);
        state.messageParts.set(msgId, parts);
      }
      if (event?.type === "message.part.delta") {
        const state = ensureSession(sessionId);
        const accumulated = (state.textSources.get(sourceKey) || "") + text;
        processSourceUpdate(sessionId, sourceKey, accumulated);
        detectAndCompleteTodos(accumulated, sessionId);
        checkAndScheduleReview(sessionId);
        return;
      }
      processSourceUpdate(sessionId, sourceKey, text);
      detectAndCompleteTodos(text, sessionId);
      checkAndScheduleReview(sessionId);
    }
  };
};
export {
  AutoReviewCompletedTodosPlugin
};
