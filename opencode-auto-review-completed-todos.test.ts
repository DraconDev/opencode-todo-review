import { describe, expect, it } from "bun:test";
import { allTodosCompleted, mergeOptions } from "./opencode-auto-review-completed-todos.js";

describe("allTodosCompleted", () => {
  it("returns false for empty array", () => {
    expect(allTodosCompleted([])).toBe(false);
  });

  it("returns false when any todo is pending", () => {
    const todos = [
      { id: "1", content: "Task 1", status: "completed", priority: "medium" },
      { id: "2", content: "Task 2", status: "pending", priority: "medium" },
    ];
    expect(allTodosCompleted(todos)).toBe(false);
  });

  it("returns true when all todos are completed", () => {
    const todos = [
      { id: "1", content: "Task 1", status: "completed", priority: "medium" },
      { id: "2", content: "Task 2", status: "completed", priority: "medium" },
    ];
    expect(allTodosCompleted(todos)).toBe(true);
  });

  it("returns true when all todos are cancelled", () => {
    const todos = [
      { id: "1", content: "Task 1", status: "cancelled", priority: "medium" },
      { id: "2", content: "Task 2", status: "cancelled", priority: "medium" },
    ];
    expect(allTodosCompleted(todos)).toBe(true);
  });

  it("returns true for mixed completed and cancelled", () => {
    const todos = [
      { id: "1", content: "Task 1", status: "completed", priority: "medium" },
      { id: "2", content: "Task 2", status: "cancelled", priority: "medium" },
    ];
    expect(allTodosCompleted(todos)).toBe(true);
  });
});

describe("mergeOptions", () => {
  it("returns defaults for null/undefined", () => {
    const result = mergeOptions(null);
    expect(result.debounceMs).toBe(500);
    expect(result.maxSessions).toBe(100);
  });

  it("returns defaults for non-object input", () => {
    const result = mergeOptions("not an object");
    expect(result.debounceMs).toBe(500);
    expect(result.maxSessions).toBe(100);
  });

  it("accepts valid debounceMs", () => {
    const result = mergeOptions({ debounceMs: 1000 });
    expect(result.debounceMs).toBe(1000);
  });

  it("rejects negative debounceMs", () => {
    const result = mergeOptions({ debounceMs: -1 });
    expect(result.debounceMs).toBe(500);
  });

  it("accepts valid maxSessions", () => {
    const result = mergeOptions({ maxSessions: 50 });
    expect(result.maxSessions).toBe(50);
  });

  it("caps maxSessions at 1000", () => {
    const result = mergeOptions({ maxSessions: 5000 });
    expect(result.maxSessions).toBe(1000);
  });
});