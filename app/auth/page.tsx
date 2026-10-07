'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function InviteCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('Completing your invitation…');

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setMessage('Authentication is not configured for this site.'); return; }
    const finish = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) { setMessage(error.message); return; }
      if (data.session) router.replace('/');
      else setMessage('Your invitation link could not be verified. Request a new invitation from a workspace admin.');
    };
    void finish();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (session) router.replace('/'); });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  return <main className="auth-page"><section className="auth-card auth-loading"><span className="loader"/><h1>Setting up your workspace</h1><p>{message}</p></section></main>;
}
