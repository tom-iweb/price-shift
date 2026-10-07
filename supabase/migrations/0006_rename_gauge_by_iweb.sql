-- Rename the workspace created by the earlier PriceShift setup script.
-- Other workspace names are left unchanged.
update public.workspaces
set name = 'Gauge by iWeb workspace'
where name = 'PriceShift workspace';
