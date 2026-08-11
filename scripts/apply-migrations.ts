import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { getDatabaseSqlFiles } from "./migrations";

const composeArgs = ["compose", "exec", "-T", "postgres", "sh", "-c", "psql -v ON_ERROR_STOP=1 -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\""];

function runSqlFile(file: string) {
  return new Promise<number>(async (resolve, reject) => {
    const input = await readFile(file, "utf8");
    const child = spawn("docker", composeArgs, {
      env: process.env,
      stdio: ["pipe", "inherit", "inherit"],
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
    child.stdin.end(input);
  });
}

for (const file of await getDatabaseSqlFiles()) {
  const code = await runSqlFile(file);
  if (code !== 0) {
    throw new Error(`Database SQL failed: ${file}`);
  }
}
