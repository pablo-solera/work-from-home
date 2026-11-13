let lastLocalMutationAt = 0;

/** Call right before a server action that changes requests, so the realtime refresh it triggers can be skipped. */
export function markLocalMutation() {
  lastLocalMutationAt = Date.now();
}

/** True while the page is still being refreshed by the server action's own revalidation. */
export function isRecentLocalMutation(windowMs = 4000) {
  return Date.now() - lastLocalMutationAt < windowMs;
}
