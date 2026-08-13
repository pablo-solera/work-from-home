-- Informe de diagnóstico del cupo semanal de teletrabajo.
-- Solo lectura. Ejecutar con:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/report-wfh-allowance.sql
--
-- El rango por defecto cubre el año 2026. Se puede cambiar sin editar el
-- script usando, por ejemplo: psql ... -v report_start=2026-01-01 -v report_end=2026-12-31

\if :{?report_start}
\else
  \set report_start '2026-01-01'
\endif
\if :{?report_end}
\else
  \set report_end '2026-12-31'
\endif

\echo '=== Parámetros ==='
SELECT :'report_start'::date AS report_start, :'report_end'::date AS report_end;

\echo '=== Usuarios sin cupo definido (NULL; tratados como 0) ==='
SELECT
  u.oracle_emp_id,
  COALESCE(u.fallback_name, u.fallback_email, u.id::text) AS user_name,
  u.has_wfh,
  u.wfh_days_allowance
FROM users AS u
WHERE u.wfh_days_allowance IS NULL
ORDER BY user_name, u.oracle_emp_id NULLS LAST;

\echo '=== Semanas que superan el cupo ==='
WITH weekly_usage AS (
  SELECT
    u.oracle_emp_id,
    COALESCE(u.fallback_name, u.fallback_email, u.id::text) AS user_name,
    u.id AS user_id,
    COALESCE(u.wfh_days_allowance, 0) AS allowance,
    date_trunc('week', w.date)::date AS week_start,
    COUNT(*)::integer AS assigned_days,
    string_agg(to_char(w.date, 'YYYY-MM-DD'), ', ' ORDER BY w.date) AS assigned_dates
  FROM work_from_home_days AS w
  INNER JOIN users AS u ON u.id = w.user_id
  WHERE w.date BETWEEN :'report_start'::date AND :'report_end'::date
  GROUP BY u.oracle_emp_id, u.fallback_name, u.fallback_email, u.id,
           u.wfh_days_allowance, date_trunc('week', w.date)::date
)
SELECT
  oracle_emp_id,
  user_name,
  week_start,
  week_start + 6 AS week_end,
  allowance,
  assigned_days,
  assigned_days - allowance AS excess_days,
  assigned_dates
FROM weekly_usage
WHERE assigned_days > allowance
ORDER BY week_start, user_name, oracle_emp_id NULLS LAST;

\echo '=== Resumen de semanas excedidas ==='
WITH weekly_usage AS (
  SELECT
    u.id AS user_id,
    COALESCE(u.wfh_days_allowance, 0) AS allowance,
    date_trunc('week', w.date)::date AS week_start,
    COUNT(*)::integer AS assigned_days
  FROM work_from_home_days AS w
  INNER JOIN users AS u ON u.id = w.user_id
  WHERE w.date BETWEEN :'report_start'::date AND :'report_end'::date
  GROUP BY u.id, u.wfh_days_allowance, date_trunc('week', w.date)::date
)
SELECT
  COUNT(*) FILTER (WHERE assigned_days > allowance)::integer AS exceeded_weeks,
  COUNT(DISTINCT user_id) FILTER (WHERE assigned_days > allowance)::integer AS affected_users,
  COALESCE(SUM(assigned_days - allowance) FILTER (WHERE assigned_days > allowance), 0)::integer AS excess_days,
  COALESCE(MAX(assigned_days - allowance) FILTER (WHERE assigned_days > allowance), 0)::integer AS max_excess_in_one_week
FROM weekly_usage;

\echo '=== Resumen por cupo ==='
WITH weekly_usage AS (
  SELECT
    u.id AS user_id,
    COALESCE(u.wfh_days_allowance, 0) AS allowance,
    date_trunc('week', w.date)::date AS week_start,
    COUNT(*)::integer AS assigned_days
  FROM work_from_home_days AS w
  INNER JOIN users AS u ON u.id = w.user_id
  WHERE w.date BETWEEN :'report_start'::date AND :'report_end'::date
  GROUP BY u.id, u.wfh_days_allowance, date_trunc('week', w.date)::date
)
SELECT
  allowance,
  COUNT(*)::integer AS observed_user_weeks,
  COUNT(*) FILTER (WHERE assigned_days > allowance)::integer AS exceeded_weeks,
  COUNT(DISTINCT user_id) FILTER (WHERE assigned_days > allowance)::integer AS affected_users
FROM weekly_usage
GROUP BY allowance
ORDER BY allowance;
