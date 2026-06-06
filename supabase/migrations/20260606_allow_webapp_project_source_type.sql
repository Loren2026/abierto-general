-- Extend projects.source_type to support invitation-gated web applications.
-- Existing OneDrive projects remain valid; this only broadens the allowed values.
alter table public.projects
  drop constraint if exists projects_source_type_check;

alter table public.projects
  add constraint projects_source_type_check
  check (source_type in ('onedrive', 'webapp', 'external_url'));
