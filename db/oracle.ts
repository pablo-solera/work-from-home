import oracledb from "oracledb";

let pool: oracledb.Pool | null = null;
let thickClientInitialized = false;

function initThickClient() {
  if (thickClientInitialized) {
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

  thickClientInitialized = true;
}

async function getOraclePool() {
  if (pool) {
    return pool;
  }

  const user = process.env.ORACLE_USER;
  const password = process.env.ORACLE_PASSWORD;
  const connectString = process.env.ORACLE_CONNECT_STRING;

  if (!user || !password || !connectString) {
    throw new Error("ORACLE_USER, ORACLE_PASSWORD and ORACLE_CONNECT_STRING are required to access the Oracle database.");
  }

  initThickClient();

  pool = await oracledb.createPool({
    user,
    password,
    connectString,
    poolMin: 0,
    poolMax: 4,
    poolIncrement: 1,
    poolTimeout: 60,
  });

  return pool;
}

/**
 * Runs a read-only query against the Oracle database and returns the rows as objects.
 * Connections are always released back to the pool.
 */
export async function queryOracle<T>(sql: string, binds: oracledb.BindParameters = {}): Promise<T[]> {
  const oraclePool = await getOraclePool();
  const connection = await oraclePool.getConnection();

  try {
    const result = await connection.execute<T>(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });

    return result.rows ?? [];
  } finally {
    await connection.close();
  }
}
