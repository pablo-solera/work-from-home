"use client";

export function RequestBadges({ pendingRequestCount: initialPending, unreadSubstitutionCount: initialUnread }: { pendingRequestCount: number; unreadSubstitutionCount: number }) {
  return <span className="ml-1 inline-flex items-center gap-0.5 align-top" aria-live="polite">{initialPending > 0 ? <span className="inline-flex min-w-4 -translate-y-1 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white">{initialPending}</span> : null}{initialUnread > 0 ? <span className="inline-flex min-w-4 -translate-y-1 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-bold leading-4 text-white">{initialUnread}</span> : null}</span>;
}
