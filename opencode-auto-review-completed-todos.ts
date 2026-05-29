// @bun
// opencode-auto-review-completed-todos.ts
import { type Plugin, type PluginOptions } from "@opencode-ai/plugin";
import type { EventTodoUpdated, Todo } from "@opencode-ai/sdk";

interface SessionState {
  reviewFired: boolean;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  createdAt: number;
}

interface Options {
  debounceMs: number;
  maxSessions?: number;
}

const DEFAULT_OPTIONS: Options = {
  debounceMs: 500,
  maxSessions: 100,
};

const MAX_SESSIONS_CAP = 1000;

function mergeOptions(raw: unknown): Options {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_OPTIONS };
  const o = raw as Record<string, unknown>;
  const maxSessions =
    typeof o.maxSessions === "number" && o.maxSessions > 0
      ? Math.min(o.maxSessions, MAX_SESSIONS_CAP)
      : DEFAULT_OPTIONS.maxSessions ?? 100;
  return {
    debounceMs:
      typeof o.debounceMs === "number" && o.debounceMs > 0
        ? o.debounceMs
        : DEFAULT_OPTIONS.debounceMs,
    maxSessions,
  };
}

function allTodosCompleted(todos: Todo[]): boolean {
  return (
    Array.isArray(todos) &&
    todos.length > 0 &&
    todos.every(
      (t: Todo) => t.status === "completed" || t.status === "cancelled",
    )
  );
}

const AutoReviewCompletedTodosPlugin: Plugin = async (input, rawOptions) => {
  const config = mergeOptions(rawOptions);
  const sessions = new Map<string, SessionState>();

  function getSession(sessionId: string): SessionState | null {
    return sessions.get(sessionId) ?? null;
  }

  function evictOldestSessions(count: number): void {
    const entries = Array.from(sessions.entries()).sort(
      (a, b) => a[1].createdAt - b[1].createdAt,
    );
    for (let i = 0; i < count && i < entries.length; i++) {
      cleanupSession(entries[i][0]);
    }
  }

  function ensureSession(sessionId: string): SessionState {
    let state = sessions.get(sessionId);
    if (!state) {
      if (sessions.size >= (config.maxSessions ?? 100)) {
        evictOldestSessions(Math.ceil((config.maxSessions ?? 100) * 0.2));
      }
      state = { reviewFired: false, debounceTimer: null, createdAt: Date.now() };
      sessions.set(sessionId, state);
    }
    return state;
  }

  function cleanupSession(sessionId: string): void {
    const state = sessions.get(sessionId);
    if (state?.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }
    sessions.delete(sessionId);
  }

  async function triggerReview(sessionId: string): Promise<void> {
    const state = sessions.get(sessionId);
    if (!state || state.reviewFired) return;

    state.reviewFired = true;
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = null;
    }

    try {
      await input.client.session.prompt({
        path: { id: sessionId },
        query: { directory: input.directory },
        body: {
          parts: [
            {
              type: "text" as const,
              text: "All tasks in this session have been completed. Please perform a final review: summarize what was accomplished, note any technical decisions or trade-offs made, flag anything that should be documented, and list any follow-up tasks or improvements for next time.",
              synthetic: false,
            },
          ],
        },
      });
    } catch {
      process.stderr.write("[auto-review] REVIEW TRIGGERED (prompt failed)\n");
    }
  }

  function scheduleReview(sessionId: string): void {
    const state = sessions.get(sessionId);
    if (!state) return;

    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      state.debounceTimer = null;
      triggerReview(sessionId);
    }, config.debounceMs);
  }

  function cancelScheduledReview(sessionId: string): void {
    const state = sessions.get(sessionId);
    if (state?.debounceTimer) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = null;
    }
  }

  return {
    event: async ({ event }) => {
      const e = event as Record<string, unknown>;
      const props = e?.properties as Record<string, unknown> | undefined;
      const sessionId: string | undefined =
        (props?.sessionID as string) ??
        ((props?.info as Record<string, unknown>)?.id as string) ??
        ((props?.path as Record<string, unknown>)?.id as string);

      if (!sessionId) return;

      if (
        e.type === "session.deleted" ||
        e.type === "session.error" ||
        e.type === "session.compacted"
      ) {
        cleanupSession(sessionId);
        return;
      }

      if (e.type === "todo.updated") {
        const todos = (e as unknown as EventTodoUpdated).properties.todos;
        if (!Array.isArray(todos)) return;

        const state = ensureSession(sessionId);

        if (allTodosCompleted(todos)) {
          scheduleReview(sessionId);
        } else {
          cancelScheduledReview(sessionId);
        }
        return;
      }
    },
  };
};

export { AutoReviewCompletedTodosPlugin };
export default AutoReviewCompletedTodosPlugin;
