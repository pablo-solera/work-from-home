import oracledb from "oracledb";

const ALLOWED_SCHEMAS = new Set([
  "TIMERTASK_ES",
  "TIMERTASK_BR",
  "TIMERTASK_CN",
  "TIMERTASK_DE",
  "TIMERTASK_FR",
  "TIMERTASK_MX",
  "TIMERTASK_US",
  "TIMERTASK_UKAD",
  "TIMERTASK_HPI",
  "TIMERTASK_ESSE",
  "TIMERTASK_MXUS",
]);

/** Returns the validated Oracle schema used in interpolated SQL identifiers. */
export function getOracleSchema() {
  const schema = (process.env.ORACLE_TIMERTASK_SCHEMA ?? "TIMERTASK_ES").toUpperCase();
  if (!ALLOWED_SCHEMAS.has(schema)) throw new Error(`Unsupported ORACLE_TIMERTASK_SCHEMA: ${schema}`);
  return schema;
}

type OracleState = {
  pool: oracledb.Pool | null;
  poolPromise: Promise<oracledb.Pool> | null;
  thickClientInitialized: boolean;
};

declare global {
  var __wfhOracleState: OracleState | undefined;
}

const state: OracleState = globalThis.__wfhOracleState ?? {
  pool: null,
  poolPromise: null,
  thickClientInitialized: false,
};
globalThis.__wfhOracleState = state;

function initThickClient() {
  if (state.thickClientInitialized) {
    return;
  }

  // Oracle 11g requires python-oracledb / node-oracledb "thick" mode, which needs
  // the Oracle Instant Client. ORACLE_CLIENT_LIB_DIR points to that install.
  // If it is not set, we let the driver try to find the client on the system PATH.
  const libDir = process.env.ORACLE_CLIENT_LIB_DIR;

  try {
    oracledb.initOracleClient(libDir ? { libDir } : undefined);
  } catch (error) {
    // initOracleClient throws if called twice; ignore that specific case.
    const message = error instanceof Error ? error.message : String(error);

    if (!message.includes("NJS-077")) {
      throw error;
    }
  }

  state.thickClientInitialized = true;
}

async function getOraclePool() {
  if (state.pool) {
    return state.pool;
  }

  if (state.poolPromise) {
    return state.poolPromise;
  }

  state.poolPromise = createOraclePool();

  try {
    state.pool = await state.poolPromise;
    return state.pool;
  } catch (error) {
    state.poolPromise = null;
    throw error;
  }
}

async function createOraclePool() {

  const user = process.env.ORACLE_USER;
  const password = process.env.ORACLE_PASSWORD;
  const connectString = process.env.ORACLE_CONNECT_STRING;

  if (!user || !password || !connectString) {
    throw new Error("ORACLE_USER, ORACLE_PASSWORD and ORACLE_CONNECT_STRING are required to access the Oracle database.");
  }

  initThickClient();

  return oracledb.createPool({
    user,
    password,
    connectString,
    poolMin: 2,
    poolMax: 20,
    poolIncrement: 1,
    poolTimeout: 60,
    queueTimeout: 5000,
  });
}

/**
 * Runs a read-only query against the Oracle database and returns the rows as objects.
 * Connections are always released back to the pool.
 */
export async function queryOracle<T>(sql: string, binds: oracledb.BindParameters = {}): Promise<T[]> {
  const oraclePool = await getOraclePool();
  const connection = await oraclePool.getConnection();

  try {
    connection.callTimeout = 5000;
    const result = await connection.execute<T>(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });

    return result.rows ?? [];
  } finally {
    await connection.close();
  }
}
