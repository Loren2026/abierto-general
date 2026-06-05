-- PREPARADO PERO SIN EJECUTAR: migración para Supabase producción.
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  full_name text not null,
  email text not null,
  phone text,
  message text,
  status text not null default 'requested' check (status in ('requested','reviewing','approved','rejected','code_generated','code_sent','cancelled')),
  source text not null default 'public_form',
  email_sent boolean not null default false,
  email_sent_at timestamptz,
  handled_by text,
  handled_at timestamptz,
  created_project_access_id uuid references public.project_accesses(id) on delete set null,
  rejection_reason text,
  internal_notes text,
  requester_ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_accesses add column if not exists sent_at timestamptz;
alter table public.project_accesses add column if not exists activated_at timestamptz;
alter table public.project_accesses add column if not exists expires_at timestamptz;
alter table public.project_accesses add column if not exists access_request_id uuid references public.access_requests(id) on delete set null;

create index if not exists idx_access_requests_project_id on public.access_requests(project_id);
create index if not exists idx_access_requests_status on public.access_requests(status);
create index if not exists idx_access_requests_created_at on public.access_requests(created_at desc);
create index if not exists idx_access_requests_email on public.access_requests(lower(email));
create index if not exists idx_project_accesses_access_request_id on public.project_accesses(access_request_id);

create or replace function public.set_access_requests_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_access_requests_updated_at on public.access_requests;
create trigger trg_access_requests_updated_at
before update on public.access_requests
for each row execute function public.set_access_requests_updated_at();
