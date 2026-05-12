import type { BulkUserCreationResult } from "./user-service";

export type BulkUserFormState = BulkUserCreationResult & {
  error?: string;
};

export const initialBulkUserFormState: BulkUserFormState = {
  created: [],
  skipped: [],
  invalid: [],
};
