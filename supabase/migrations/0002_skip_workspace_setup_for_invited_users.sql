-- Invites are attached to an existing workspace by the server route. Avoid
-- creating an unused personal workspace when Supabase creates the auth user.
create or replace function public.create_workspace_for_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare new_workspace_id uuid;
begin
  if new.raw_user_meta_data ? 'skip_workspace_setup' then
    return new;
  end if;
  insert into public.workspaces (name) values (coalesce(new.raw_user_meta_data ->> 'workspace_name', split_part(new.email, '@', 1) || '''s workspace')) returning id into new_workspace_id;
  insert into public.workspace_members (workspace_id, user_id, role) values (new_workspace_id, new.id, 'admin');
  insert into public.pricing_settings (workspace_id) values (new_workspace_id);
  return new;
end;
$$;
