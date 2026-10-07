'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'ready' | 'configuration'>('loading');

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setState('configuration'); return; }
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login');
      else setState('ready');
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login');
      else setState('ready');
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  if (state === 'ready') return <>{children}</>;
  if (state === 'configuration') return <main className="auth-page"><section className="auth-card"><div className="brand compact"><span className="brand-mark">G</span><span><strong>Gauge</strong><small>by iWeb · Margin Control</small></span></div><h1>Authentication needs configuration</h1><p>Add your Supabase URL and anon key to <code>.env.local</code> before signing in.</p></section></main>;
  return <main className="auth-page"><section className="auth-card auth-loading"><span className="loader"/><p>Checking your secure session…</p></section></main>;
}
