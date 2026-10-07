'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const configured = Boolean(createClient());

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setStep('code'); setMessage(`We sent a verification code to ${email}.`);
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    router.replace('/');
  }

  return <main className="auth-page"><section className="auth-card"><div className="brand compact"><span className="brand-mark">PS</span><span><strong>PriceShift</strong><small>Margin Control</small></span></div><span className="eyebrow">Secure workspace access</span><h1>{step === 'email' ? 'Sign in to PriceShift' : 'Enter your verification code'}</h1><p>{step === 'email' ? 'Use your work email. We’ll send a one-time verification code.' : 'Enter the code from your email to continue.'}</p>{!configured ? <div className="auth-notice">Supabase is not configured yet. Add the two <code>NEXT_PUBLIC_SUPABASE_*</code> variables locally or in Vercel.</div> : step === 'email' ? <form className="auth-form" onSubmit={sendCode}><label>Work email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required autoFocus /></label><button className="button primary" disabled={busy}>{busy ? 'Sending code…' : 'Email me a code'}</button></form> : <form className="auth-form" onSubmit={verifyCode}><label>Verification code<input value={code} onChange={e => setCode(e.target.value.replace(/\s/g, ''))} inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="123456" required autoFocus /></label><button className="button primary" disabled={busy}>{busy ? 'Verifying…' : 'Verify and continue'}</button><button className="text-button" type="button" onClick={() => { setStep('email'); setCode(''); }}>Use a different email</button></form>}{message && <p className="auth-message">{message}</p>}</section></main>;
}
