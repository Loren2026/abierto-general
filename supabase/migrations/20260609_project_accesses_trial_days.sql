-- LÍNEA ROJA: MIGRACIÓN PREPARADA, NO APLICAR SIN AUTORIZACIÓN EXPLÍCITA DE LOREN

alter table public.project_accesses
  add column if not exists trial_days integer null;

alter table public.project_accesses
  add column if not exists activated_at timestamptz null;

alter table public.project_accesses
  add constraint project_accesses_trial_days_positive
  check (trial_days is null or trial_days > 0);

-- Rollback preparado, NO ejecutar salvo decisión explícita:
-- alter table public.project_accesses drop constraint if exists project_accesses_trial_days_positive;
-- alter table public.project_accesses drop column if exists trial_days;
