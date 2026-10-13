const POSTGRES_TABLES = new Set([
  "users",
  "work_from_home_days",
  "wfh_change_requests",
  "wfh_change_request_dates",
]);

const BLOCKED_WORDS = new Set([
  "insert", "update", "delete", "merge", "drop", "alter", "create", "truncate", "grant", "revoke",
  "copy", "call", "execute", "commit", "rollback", "savepoint", "vacuum", "analyze", "refresh",
  "attach", "detach", "pragma", "into", "lock", "set", "reset", "do", "begin",
  "information_schema", "pg_catalog",
]);

const BLOCKED_FUNCTIONS = new Set([
  "pg_sleep", "pg_read_file", "pg_read_binary_file", "pg_ls_dir", "pg_logdir_ls", "dblink",
  "lo_import", "lo_export", "set_config", "utl_http", "utl_file", "utl_smtp", "dbms_scheduler",
  "nextval", "setval", "pg_advisory_lock", "pg_advisory_xact_lock", "pg_notify", "pg_cancel_backend", "pg_terminate_backend",
]);

const SAFE_FUNCTIONS = new Set([
  "abs", "avg", "cast", "ceil", "ceiling", "char_length", "coalesce", "concat", "count", "date_part", "date_trunc",
  "decode", "dense_rank", "extract", "first_value", "floor", "greatest", "initcap", "instr", "json_agg", "jsonb_agg",
  "jsonb_array_length", "lag", "last_day", "last_value", "lead", "least", "length", "listagg", "lower", "ltrim",
  "max", "min", "months_between", "nullif", "nvl", "nvl2", "percent_rank", "rank", "regexp_like", "regexp_replace",
  "regexp_substr", "replace", "round", "row_number", "rtrim", "string_agg", "substr", "substring", "sum", "to_char",
  "to_date", "to_number", "to_timestamp", "trim", "trunc", "upper", "width_bucket",
  "all", "any", "array_agg", "bool_and", "bool_or", "case", "cast", "extract", "filter", "grouping", "json_build_object",
  "jsonb_build_object", "nulls_first", "nulls_last", "overlaps", "percentile_cont", "percentile_disc", "string_to_array",
  "timezone", "to_json", "to_jsonb", "xmlagg",
]);

type Token = { value: string; kind: "identifier" | "literal" | "symbol" };

function tokenize(query: string): Token[] {
  if (query.includes("--") || query.includes("/*") || query.includes("*/")) throw new Error("No se permiten comentarios SQL.");
  const tokens: Token[] = [];
  for (let index = 0; index < query.length;) {
    const character = query[index];
    if (/\s/.test(character)) { index += 1; continue; }
    if (character === ";") throw new Error("Solo se permite una consulta SQL.");
    if (character === "'") {
      index += 1;
      let closed = false;
      while (index < query.length) {
        if (query[index] === "'" && query[index + 1] === "'") { index += 2; continue; }
        if (query[index] === "'") { index += 1; closed = true; break; }
        index += 1;
      }
      if (!closed) throw new Error("Literal SQL sin cerrar.");
      tokens.push({ kind: "literal", value: "<literal>" });
      continue;
    }
    if (character === '"') {
      index += 1;
      let identifier = "";
      let closed = false;
      while (index < query.length) {
        if (query[index] === '"' && query[index + 1] === '"') { identifier += '"'; index += 2; continue; }
        if (query[index] === '"') { index += 1; closed = true; break; }
        identifier += query[index++];
      }
      if (!closed) throw new Error("Identificador SQL sin cerrar.");
      tokens.push({ kind: "identifier", value: identifier.toLowerCase() });
      continue;
    }
    if (/[a-zA-Z_]/.test(character)) {
      let end = index + 1;
      while (end < query.length && /[a-zA-Z0-9_$]/.test(query[end])) end += 1;
      tokens.push({ kind: "identifier", value: query.slice(index, end).toLowerCase() });
      index = end;
      continue;
    }
    if (character === "$") throw new Error("La sintaxis dollar-quoted no está permitida.");
    if (character === "@") throw new Error("No se permiten enlaces a otras bases de datos.");
    tokens.push({ kind: "symbol", value: character });
    index += 1;
  }
  return tokens;
}

function validateReadOnlyShape(query: string) {
  const trimmed = query.trim().replace(/;\s*$/, "");
  if (!trimmed || trimmed.length > 20_000) throw new Error("La consulta está vacía o supera el límite permitido.");
  const tokens = tokenize(trimmed);
  let depth = 0;
  for (const token of tokens) {
    if (token.value === "(") depth += 1;
    if (token.value === ")") {
      depth -= 1;
      if (depth < 0) throw new Error("Paréntesis SQL desbalanceados.");
    }
  }
  if (depth !== 0) throw new Error("Paréntesis SQL desbalanceados.");
  const first = tokens[0]?.kind === "identifier" ? tokens[0].value : undefined;
  if (first !== "select" && first !== "with") throw new Error("Solo se permiten consultas SELECT o WITH ... SELECT.");
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind !== "identifier") continue;
    if (BLOCKED_WORDS.has(token.value)) throw new Error(`La consulta contiene una operación no permitida: ${token.value}.`);
    if (BLOCKED_FUNCTIONS.has(token.value) && tokens[index + 1]?.value === "(") throw new Error(`La función ${token.value} no está permitida.`);
    if (tokens[index + 1]?.value === "(" && !SAFE_FUNCTIONS.has(token.value) && !["in", "exists", "over", "partition", "values", "select", "as", "with", "from", "join"].includes(token.value)) {
      throw new Error(`La función SQL ${token.value} no está en la lista permitida.`);
    }
  }
  return tokens;
}

function getCteNames(tokens: Token[]) {
  const names = new Set<string>();
  if (tokens[0]?.value !== "with") return names;
  let index = tokens[1]?.value === "recursive" ? 2 : 1;
  while (tokens[index]?.kind === "identifier") {
    names.add(tokens[index].value);
    index += 1;
    if (tokens[index]?.value === "(") index = skipBalanced(tokens, index);
    if (tokens[index]?.value !== "as") break;
    index += 1;
    if (tokens[index]?.value === "not") index += 2;
    if (tokens[index]?.value !== "(") break;
    index = skipBalanced(tokens, index);
    if (tokens[index]?.value !== ",") break;
    index += 1;
  }
  return names;
}

function skipBalanced(tokens: Token[], openIndex: number) {
  let depth = 0;
  for (let index = openIndex; index < tokens.length; index += 1) {
    if (tokens[index].value === "(") depth += 1;
    if (tokens[index].value === ")" && --depth === 0) return index + 1;
  }
  throw new Error("Paréntesis SQL sin cerrar.");
}

function validateSource(tokens: Token[], index: number, allowed: Set<string>, ctes: Set<string>, expectedSchema?: string, requireQualified = false) {
  while (tokens[index]?.value === "only" || tokens[index]?.value === "lateral") index += 1;
  if (tokens[index]?.value === "(") {
    const firstNested = tokens[index + 1];
    if (firstNested?.kind !== "identifier" || (firstNested.value !== "select" && firstNested.value !== "with")) {
      throw new Error("Las tablas entre paréntesis no están permitidas; usa una subconsulta SELECT.");
    }
    return;
  }
  const first = tokens[index]?.value;
  if (!first || tokens[index]?.kind !== "identifier") throw new Error("No se pudo validar una tabla de la consulta.");
  const qualified = tokens[index + 1]?.value === ".";
  const table = qualified ? tokens[index + 2]?.value : first;
  if (!table) throw new Error("Nombre de tabla incompleto.");
  if (qualified) {
    if (!expectedSchema || first !== expectedSchema || (allowed.size > 0 && !allowed.has(table))) throw new Error("La consulta referencia un esquema o tabla no permitido.");
  } else if (!ctes.has(table) && (!allowed.has(table) || requireQualified)) {
    throw new Error(requireQualified ? `Las tablas Oracle deben estar cualificadas por ${expectedSchema}.` : "La consulta solo puede acceder a las tablas permitidas.");
  }
}

function validateSources(tokens: Token[], allowed: Set<string>, ctes: Set<string>, expectedSchema?: string, requireQualified = false) {
  const fromAtDepth = new Map<number, boolean>();
  const expectAtDepth = new Set<number>();
  let depth = 0;
  const boundaries = new Set(["where", "group", "order", "having", "limit", "offset", "fetch", "union", "intersect", "except", "window", "for", "connect", "start", "model"]);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.value === "(" && expectAtDepth.has(depth)) {
      expectAtDepth.delete(depth);
      depth += 1;
      continue;
    }
    if (token.value === ")") {
      fromAtDepth.delete(depth);
      expectAtDepth.delete(depth);
      depth -= 1;
      continue;
    }
    if (token.value === "(") { depth += 1; continue; }

    if (expectAtDepth.has(depth)) {
      validateSource(tokens, index, allowed, ctes, expectedSchema, requireQualified);
      expectAtDepth.delete(depth);
      continue;
    }

    if (token.kind === "identifier" && boundaries.has(token.value)) {
      fromAtDepth.set(depth, false);
      continue;
    }
    if (token.value === "from" || token.value === "join") {
      fromAtDepth.set(depth, true);
      expectAtDepth.add(depth);
      continue;
    }
    if (token.value === "," && fromAtDepth.get(depth)) expectAtDepth.add(depth);
  }
  if (expectAtDepth.size > 0) throw new Error("Falta indicar una tabla en la consulta.");
}

export function validatePostgresQuery(query: string) {
  const tokens = validateReadOnlyShape(query);
  const ctes = getCteNames(tokens);
  validateSources(tokens, POSTGRES_TABLES, ctes, "public", true);
  return query.trim().replace(/;\s*$/, "");
}

export function validateOracleQuery(query: string) {
  const tokens = validateReadOnlyShape(query);
  const ctes = getCteNames(tokens);
  validateSources(tokens, new Set(), ctes, "timertask_es", true);
  return query.trim().replace(/;\s*$/, "");
}
