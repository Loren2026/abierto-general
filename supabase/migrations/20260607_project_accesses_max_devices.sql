-- Add configurable active-device limit per project access.
-- Default 1 preserves the current one-device-per-access behavior for all existing users.
alter table public.project_accesses
  add column if not exists max_devices integer not null default 1;

comment on column public.project_accesses.max_devices is
  'Maximum number of active devices allowed for this access. Default 1 preserves legacy behavior.';

-- Revert / rollback if needed:
-- alter table public.project_accesses drop column if exists max_devices;
