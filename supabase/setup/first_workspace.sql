-- Run once in the Supabase SQL Editor if the first workspace owner signed in
-- before the 0001 migration trigger was installed.
-- Replace both values before running this script.
do $$
declare
  target_email text := 'tom@iweb.co.uk';
  target_workspace_name text := 'PriceShift workspace';
  target_user_id uuid;
  target_workspace_id uuid;
begin
  select id into target_user_id
  from auth.users
  where lower(email) = lower(target_email);

  if target_user_id is null then
    raise exception 'No Supabase user exists for %', target_email;
  end if;

  select workspace_id into target_workspace_id
  from public.workspace_members
  where user_id = target_user_id
  limit 1;

  if target_workspace_id is null then
    insert into public.workspaces (name)
    values (target_workspace_name)
    returning id into target_workspace_id;

    insert into public.pricing_settings (workspace_id)
    values (target_workspace_id);

    insert into public.workspace_members (workspace_id, user_id, role)
    values (target_workspace_id, target_user_id, 'admin');
  else
    update public.workspace_members
    set role = 'admin'
    where workspace_id = target_workspace_id
      and user_id = target_user_id;
  end if;
end;
$$;
