import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";

const tables = [
  "users",
  "sessions",
  "tasks",
  "applications",
  "evidence",
  "evidence_versions",
  "confirmations",
  "events",
  "reports",
  "rate_limits",
];
const tablePattern = new RegExp(`\\b(${tables.join("|")})\\b`, "g");
// Every query uses schema-qualified tables; transaction poolers do not retain SET search_path.
export function postgresSql(sql, schema = "skillbridge") {
  if (!/^[a-z_][a-z0-9_]*$/.test(schema))
    throw new Error("Invalid database schema.");
  let parameter = 0;
  return sql
    .split(/('(?:''|[^'])*'|"(?:""|[^"])*")/g)
    .map((part, index) =>
      index % 2
        ? part
        : part
            .replace(tablePattern, (name) => `${schema}.${name}`)
            .replace(/\?/g, () => `$${++parameter}`),
    )
    .join("");
}
export function databaseOptions(
  connectionString,
  ca = process.env.DATABASE_CA_CERT,
) {
  if (!connectionString)
    throw new Error("DATABASE_URL is required for the deployed API.");
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(
      "DATABASE_URL is not a valid PostgreSQL URI. Keep its value private.",
    );
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL.");
  if (
    ["sslrootcert", "sslcert", "sslkey"].some((key) =>
      url.searchParams.has(key),
    )
  )
    throw new Error(
      "Use DATABASE_CA_CERT for a custom CA instead of certificate file parameters in DATABASE_URL.",
    );
  // pg connection-string SSL parameters must not override certificate verification.
  for (const key of ["sslmode", "ssl", "uselibpqcompat"])
    url.searchParams.delete(key);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return {
    connectionString: url.href,
    ssl: local
      ? false
      : {
          rejectUnauthorized: true,
          ...(ca ? { ca: ca.replace(/\\n/g, "\n") } : {}),
        },
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true,
    query_timeout: 15000,
    application_name: "skillbridge-sa",
  };
}
export function openPostgresStore(
  connectionString,
  { schema = "skillbridge", ca } = {},
) {
  const pool = new pg.Pool(databaseOptions(connectionString, ca));
  // Pool idle errors must not become an unhandled process error or disclose credentials.
  pool.on("error", (error) =>
    console.error(
      "Database connection closed:",
      error.code || "connection_error",
    ),
  );
  const transactionContext = new AsyncLocalStorage();
  const query = (sql, params = []) =>
    (transactionContext.getStore() || pool).query(
      postgresSql(sql, schema),
      params,
    );
  return {
    kind: "postgres",
    async get(sql, ...params) {
      return (await query(sql, params)).rows[0];
    },
    async all(sql, ...params) {
      return (await query(sql, params)).rows;
    },
    async run(sql, ...params) {
      const result = await query(sql, params);
      return { changes: result.rowCount };
    },
    async transaction(fn) {
      if (transactionContext.getStore()) return fn();
      const client = await pool.connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        const result = await transactionContext.run(client, fn);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    // Used only by the one-time migration command and test setup, never with user input.
    async migrate(sql) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}
