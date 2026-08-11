export type SyncUsersState = {
  ok?: boolean;
  error?: string;
  created?: number;
  deleted?: number;
};

export const initialSyncUsersState: SyncUsersState = {};
