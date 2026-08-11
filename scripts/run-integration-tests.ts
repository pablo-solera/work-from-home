import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { getDatabaseSqlFiles } from "./migrations";

const composeArgs = ["compose", "-p", "work-from-home-test", "-f", "docker-compose.test.yml"];
function run(command: string, args: string[], env?: Record<string, string>) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: "inherit", shell: process.platform === "win32" });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

function capture(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { env: process.env, stdio: ["ignore", "pipe", "inherit"], shell: process.platform === "win32" });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(`${command} exited with ${code}`)));
  });
}

async function runSqlFile(file: string) {
  const input = await readFile(file, "utf8");
  return new Promise<number>((resolve, reject) => {
    const child = spawn("docker", [...composeArgs, "exec", "-T", "postgres-test", "psql", "-v", "ON_ERROR_STOP=1", "-U", "work_from_home_test", "-d", "work_from_home_test"], { stdio: ["pipe", "inherit", "inherit"], shell: process.platform === "win32" });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
    child.stdin.end(input);
  });
}

const upCode = await run("docker", [...composeArgs, "up", "-d", "--wait"]);
if (upCode !== 0) process.exit(upCode);

try {
  const publishedPort = await capture("docker", [...composeArgs, "port", "postgres-test", "5432"]);
  const hostPort = publishedPort.split(":").at(-1);
  if (!hostPort) throw new Error(`Could not determine PostgreSQL test port from: ${publishedPort}`);
  const databaseUrl = `postgres://work_from_home_test:work_from_home_test_password@localhost:${hostPort}/work_from_home_test`;
   for (const file of await getDatabaseSqlFiles()) {
     const sqlCode = await runSqlFile(file);
     if (sqlCode !== 0) throw new Error(`${file} failed with exit code ${sqlCode}`);
   }

  const testCode = await run("bunx", ["vitest", "run", "--config", "vitest.integration.config.ts"], { DATABASE_URL: databaseUrl });
  process.exitCode = testCode;
} finally {
  await run("docker", [...composeArgs, "down"]);
}
