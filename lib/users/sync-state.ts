export type SyncUsersState = {
  ok?: boolean;
  error?: string;
  created?: number;
  deactivated?: number;
};

export const initialSyncUsersState: SyncUsersState = {};
