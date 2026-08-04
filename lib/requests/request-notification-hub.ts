import { getPostgresClient } from "@/db";

const CHANNEL = "wfh_request_changed";
const encoder = new TextEncoder();

type Connection = {
  role: "admin" | "coordinator" | "employee";
  userId: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
};

type Hub = {
  connections: Map<string, Set<Connection>>;
  listenerPromise: Promise<void> | null;
};

declare global {
  var __wfhRequestNotificationHub: Hub | undefined;
}

const hub: Hub = globalThis.__wfhRequestNotificationHub ?? {
  connections: new Map(),
  listenerPromise: null,
};
globalThis.__wfhRequestNotificationHub = hub;

function send(connection: Connection, event: string, data = "{}") {
  try {
    connection.controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
  } catch {
    removeConnection(connection);
  }
}

function removeConnection(connection: Connection) {
  const connections = hub.connections.get(connection.userId);
  connections?.delete(connection);
  if (connections?.size === 0) hub.connections.delete(connection.userId);
}

function broadcast(userId: string) {
  for (const connection of hub.connections.get(userId) ?? []) {
    send(connection, "requests-changed");
  }
}

function broadcastAdmins() {
  for (const connections of hub.connections.values()) {
    for (const connection of connections) {
      if (connection.role === "admin") send(connection, "requests-changed");
    }
  }
}

function broadcastNotification(payload: string) {
  try {
    const event = JSON.parse(payload) as { coordinatorId?: string; requesterId?: string; notifyRequester?: boolean; notifyAdmins?: boolean };
    if (event.coordinatorId && event.coordinatorId !== event.requesterId) broadcast(event.coordinatorId);
    if (event.notifyRequester && event.requesterId) broadcast(event.requesterId);
    if (event.notifyAdmins) {
      broadcastAdmins();
    }
  } catch {
    // Support the UUID-only payload emitted by older database triggers.
    broadcast(payload.trim());
  }
}

async function ensureListener() {
  if (hub.listenerPromise) return hub.listenerPromise;

  hub.listenerPromise = getPostgresClient()
    .listen(CHANNEL, (payload) => broadcastNotification(payload), () => {
      for (const userId of hub.connections.keys()) broadcast(userId);
    })
    .then(() => undefined)
    .catch((error) => {
      hub.listenerPromise = null;
      console.error("Request notification listener failed:", error);
      throw error;
    });

  return hub.listenerPromise;
}

export async function subscribeToRequestNotifications(userId: string, role: Connection["role"], controller: ReadableStreamDefaultController<Uint8Array>) {
  await ensureListener();
  const connection = { role, userId, controller };
  const connections = hub.connections.get(userId) ?? new Set<Connection>();
  connections.add(connection);
  hub.connections.set(userId, connections);
  send(connection, "ready");

  return () => removeConnection(connection);
}
