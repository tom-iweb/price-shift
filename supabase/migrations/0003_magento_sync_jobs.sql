create table public.magento_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  next_page integer not null default 1,
  total_products integer,
  processed_products integer not null default 0,
  custom_options integer not null default 0,
  error text,
  locked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index magento_sync_jobs_one_active_per_workspace on public.magento_sync_jobs (workspace_id) where status in ('queued', 'running');
create index magento_sync_jobs_worker_queue on public.magento_sync_jobs (status, created_at);
alter table public.magento_sync_jobs enable row level security;
create policy "members can read Magento sync jobs" on public.magento_sync_jobs for select using (public.is_workspace_member(workspace_id));
