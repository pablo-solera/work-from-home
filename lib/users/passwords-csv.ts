import type { SyncPassword } from "@/lib/users/sync-state";

const BOM = "\uFEFF";

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Builds a CSV with the temporary passwords for newly created users.
 * Prepends a UTF-8 BOM so Excel on Windows renders accents correctly.
 */
export function buildPasswordsCsv(passwords: SyncPassword[]): string {
  const lines = ["name,email,password", ...passwords.map((row) => [row.name, row.email, row.password].map(escapeCsv).join(","))];

  return `${BOM}${lines.join("\n")}\n`;
}
