import path from "node:path";

export type ImportRow = { empId: number; dates: string[]; sourceRow: number };

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function generateSql(rows: ImportRow[], sheet: string, input: string) {
  const users = rows.map(({ empId }) => `  (${empId})`).join(",\n");
  const dates = rows.flatMap(({ empId, dates }) => dates.map((date) => `  (${empId}, ${sqlString(date)})`)).join(",\n");

  return `-- Generado desde ${path.basename(input)}; hoja ${sheet}; fuente no versionada.
-- Ejecutar con: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f import-wfh.sql
-- Este SQL es autoritativo para los días de 2026 de los emp_id incluidos.
BEGIN;

CREATE TEMP TABLE wfh_import_employees (oracle_emp_id integer PRIMARY KEY) ON COMMIT DROP;
INSERT INTO wfh_import_employees (oracle_emp_id) VALUES
${users};

CREATE TEMP TABLE wfh_import_days (oracle_emp_id integer NOT NULL, wfh_date date NOT NULL, PRIMARY KEY (oracle_emp_id, wfh_date)) ON COMMIT DROP;
${dates ? `INSERT INTO wfh_import_days (oracle_emp_id, wfh_date) VALUES\n${dates};` : "-- El Excel no contiene días marcados."}

-- Solo las solicitudes aceptadas ya forman parte del calendario. Cada tipo contradice el Excel de forma distinta.
CREATE TEMP TABLE wfh_import_conflicts ON COMMIT DROP AS
SELECT u.oracle_emp_id, d.requested_date AS fecha, r.kind::text AS tipo, 'el día solicitado falta en el Excel' AS motivo
FROM wfh_change_request_dates d
JOIN wfh_change_requests r ON r.id = d.request_id
JOIN users u ON u.id = r.requester_id
JOIN wfh_import_employees e ON e.oracle_emp_id = u.oracle_emp_id
WHERE r.status = 'accepted'
  AND r.kind IN ('additional', 'substitution')
  AND d.cancelled_at IS NULL
  AND d.requested_date BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
  AND NOT EXISTS (SELECT 1 FROM wfh_import_days i WHERE i.oracle_emp_id = e.oracle_emp_id AND i.wfh_date = d.requested_date)
UNION ALL
SELECT u.oracle_emp_id, d.replaced_date, r.kind::text, 'el día sustituido sigue en el Excel'
FROM wfh_change_request_dates d
JOIN wfh_change_requests r ON r.id = d.request_id
JOIN users u ON u.id = r.requester_id
JOIN wfh_import_employees e ON e.oracle_emp_id = u.oracle_emp_id
WHERE r.status = 'accepted'
  AND r.kind = 'substitution'
  AND d.cancelled_at IS NULL
  AND d.replaced_date BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
  AND EXISTS (SELECT 1 FROM wfh_import_days i WHERE i.oracle_emp_id = e.oracle_emp_id AND i.wfh_date = d.replaced_date)
UNION ALL
SELECT u.oracle_emp_id, d.requested_date, r.kind::text, 'el día anulado sigue en el Excel'
FROM wfh_change_request_dates d
JOIN wfh_change_requests r ON r.id = d.request_id
JOIN users u ON u.id = r.requester_id
JOIN wfh_import_employees e ON e.oracle_emp_id = u.oracle_emp_id
WHERE r.status = 'accepted'
  AND r.kind = 'removal'
  AND d.cancelled_at IS NULL
  AND d.requested_date BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
  AND EXISTS (SELECT 1 FROM wfh_import_days i WHERE i.oracle_emp_id = e.oracle_emp_id AND i.wfh_date = d.requested_date);

DO $$
DECLARE
  total integer;
  detail text;
BEGIN
  IF EXISTS (SELECT 1 FROM wfh_import_employees e LEFT JOIN users u ON u.oracle_emp_id = e.oracle_emp_id WHERE u.id IS NULL) THEN
    RAISE NOTICE 'Se omiten oracle_emp_id del Excel que no existen en users.';
  END IF;

  SELECT count(*) INTO total FROM wfh_import_conflicts;
  IF total > 0 THEN
    SELECT string_agg(format('oracle_emp_id %s, %s, %s: %s', oracle_emp_id, fecha, tipo, motivo), E'\\n' ORDER BY oracle_emp_id, fecha)
      INTO detail
      FROM (SELECT * FROM wfh_import_conflicts ORDER BY oracle_emp_id, fecha LIMIT 20) first_conflicts;
    RAISE EXCEPTION E'Importación detenida: % solicitudes aceptadas contradicen el Excel (se muestran hasta 20).\\n%', total, detail;
  END IF;
END $$;

DELETE FROM work_from_home_days w
USING users u, wfh_import_employees e
WHERE w.user_id = u.id
  AND u.oracle_emp_id = e.oracle_emp_id
  AND w.date BETWEEN DATE '2026-01-01' AND DATE '2026-12-31';

INSERT INTO work_from_home_days (user_id, date)
SELECT u.id, i.wfh_date
FROM users u
JOIN wfh_import_days i ON i.oracle_emp_id = u.oracle_emp_id;

COMMIT;
`;
}
