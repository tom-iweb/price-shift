import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const roles = ['admin', 'editor', 'viewer'] as const;
type Role = typeof roles[number];

function validRole(value: unknown): value is Role { return typeof value === 'string' && roles.includes(value as Role); }

async function authorize(request: NextRequest, workspaceId: unknown) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || typeof workspaceId !== 'string') throw new Error('Sign in and choose a workspace before managing users.');
  const admin = createAdminClient();
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) throw new Error('Your session is invalid.');
  const { data: membership } = await admin.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', auth.user.id).eq('role', 'admin').maybeSingle();
  if (!membership) throw new Error('Only workspace admins can manage users.');
  return { admin, user: auth.user, workspaceId };
}

async function workspaceUsers(admin: ReturnType<typeof createAdminClient>, workspaceId: string) {
  const { data: memberships, error } = await admin.from('workspace_members').select('user_id, role').eq('workspace_id', workspaceId).order('role').order('user_id');
  if (error) throw error;
  const users = await Promise.all((memberships ?? []).map(async (membership) => {
    const { data } = await admin.auth.admin.getUserById(membership.user_id);
    const user = data.user;
    return { id: membership.user_id, email: user?.email ?? 'Unknown user', role: membership.role, lastSignInAt: user?.last_sign_in_at ?? null, invitedAt: user?.invited_at ?? null };
  }));
  return users.sort((left, right) => left.email.localeCompare(right.email));
}

async function findUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function protectLastAdmin(admin: ReturnType<typeof createAdminClient>, workspaceId: string, userId: string) {
  const { data: member, error } = await admin.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!member) throw new Error('That user is not in this workspace.');
  if (member.role !== 'admin') return;
  const { count, error: countError } = await admin.from('workspace_members').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('role', 'admin');
  if (countError) throw countError;
  if ((count ?? 0) <= 1) throw new Error('Add another admin before removing the last workspace admin.');
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Could not manage workspace users.';
  const status = message.includes('Only workspace admins') ? 403 : message.includes('session') || message.includes('Sign in') ? 401 : message.includes('not in this workspace') ? 404 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try { const { admin, workspaceId } = await authorize(request, request.nextUrl.searchParams.get('workspaceId')); return NextResponse.json({ users: await workspaceUsers(admin, workspaceId) }); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json(); const { admin, user: actor, workspaceId } = await authorize(request, body.workspaceId);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^\S+@\S+\.\S+$/.test(email) || !validRole(body.role)) throw new Error('Enter a valid email address and role.');
    let account = await findUserByEmail(admin, email); let invited = false;
    if (!account) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: new URL('/auth', request.url).toString(), data: { skip_workspace_setup: true } });
      if (error || !data.user) throw error ?? new Error('Could not send an invitation.');
      account = data.user; invited = true;
    }
    const { error } = await admin.from('workspace_members').upsert({ workspace_id: workspaceId, user_id: account.id, role: body.role }, { onConflict: 'workspace_id,user_id' });
    if (error) throw error;
    await admin.from('audit_log').insert({ workspace_id: workspaceId, action: invited ? 'user_invited' : 'user_added', subject_type: 'user', subject_id: account.id, payload: { email, role: body.role }, created_by: actor.id });
    return NextResponse.json({ users: await workspaceUsers(admin, workspaceId), invited });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json(); const { admin, user: actor, workspaceId } = await authorize(request, body.workspaceId);
    if (typeof body.userId !== 'string' || !validRole(body.role)) throw new Error('Choose a user and valid role.');
    const { data: existing, error: existingError } = await admin.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', body.userId).maybeSingle();
    if (existingError) throw existingError;
    if (!existing) throw new Error('That user is not in this workspace.');
    if (body.role !== 'admin') await protectLastAdmin(admin, workspaceId, body.userId);
    const { error } = await admin.from('workspace_members').update({ role: body.role }).eq('workspace_id', workspaceId).eq('user_id', body.userId);
    if (error) throw error;
    await admin.from('audit_log').insert({ workspace_id: workspaceId, action: 'user_role_updated', subject_type: 'user', subject_id: body.userId, payload: { role: body.role }, created_by: actor.id });
    return NextResponse.json({ users: await workspaceUsers(admin, workspaceId) });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json(); const { admin, user: actor, workspaceId } = await authorize(request, body.workspaceId);
    if (typeof body.userId !== 'string') throw new Error('Choose a user to remove.');
    if (body.userId === actor.id) throw new Error('Ask another workspace admin to remove your access.');
    await protectLastAdmin(admin, workspaceId, body.userId);
    const { error } = await admin.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', body.userId);
    if (error) throw error;
    await admin.from('audit_log').insert({ workspace_id: workspaceId, action: 'user_removed', subject_type: 'user', subject_id: body.userId, payload: {}, created_by: actor.id });
    return NextResponse.json({ users: await workspaceUsers(admin, workspaceId) });
  } catch (error) { return errorResponse(error); }
}
