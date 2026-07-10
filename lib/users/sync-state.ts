export type SyncPassword = { name: string; email: string; password: string };

export type SyncUsersState = {
  ok?: boolean;
  error?: string;
  created?: number;
  deleted?: number;
  passwords?: SyncPassword[];
};

export const initialSyncUsersState: SyncUsersState = {};
