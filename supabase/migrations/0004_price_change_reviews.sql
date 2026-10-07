alter type public.price_status add value if not exists 'price_pending';

create table public.price_change_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uplift_pct numeric not null check (uplift_pct <> 0),
  include_custom_options boolean not null default false,
  filters jsonb not null default '{}',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.price_change_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.price_change_batches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  old_price_pence integer not null,
  new_price_pence integer not null,
  old_option_values jsonb,
  new_option_values jsonb,
  status text not null default 'pending' check (status in ('pending', 'published', 'failed')),
  error text,
  published_at timestamptz,
  unique(batch_id, product_id)
);

create index price_change_items_review_queue on public.price_change_items (status, batch_id);
alter table public.price_change_batches enable row level security;
alter table public.price_change_items enable row level security;
create policy "members can read price change batches" on public.price_change_batches for select using (public.is_workspace_member(workspace_id));
create policy "editors can create price change batches" on public.price_change_batches for insert with check (public.can_edit_workspace(workspace_id));
create policy "members can read price change items" on public.price_change_items for select using (exists (select 1 from public.price_change_batches b where b.id = batch_id and public.is_workspace_member(b.workspace_id)));
