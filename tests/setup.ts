import "@testing-library/jest-dom/vitest";

process.env.SESSION_SECRET ??= "test-only-session-secret-with-enough-entropy";
