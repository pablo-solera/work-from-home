export type UserManagementState = {
  error?: string;
  generatedPassword?: string;
  message?: string;
  ok?: boolean;
};

export const initialUserManagementState: UserManagementState = {};
