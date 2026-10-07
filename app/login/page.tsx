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
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
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

  return <main className="price-login-page">
    <section className="price-login-story">
      <div className="price-login-brand"><span>G</span> Gauge <small>by iWeb</small></div>
      <div className="price-login-copy"><span className="price-login-eyebrow">Margin control workspace</span><h1>Keep every price decision commercially sound.</h1><p>Bring supplier costs, selling prices and approval decisions into one calm workspace built for confident margin control.</p><div className="price-login-signal" aria-hidden="true"><div><span>Portfolio margin</span><strong>37.4%</strong></div><svg viewBox="0 0 480 120" preserveAspectRatio="none"><defs><linearGradient id="priceLoginChart" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#71a4ff"/><stop offset="1" stopColor="#54d6ad"/></linearGradient></defs><path d="M0 96 C42 86 64 96 103 73 S160 87 205 60 S260 72 302 46 S357 56 397 27 S442 36 480 13" fill="none" stroke="url(#priceLoginChart)" strokeWidth="4" strokeLinecap="round"/><path d="M0 96 C42 86 64 96 103 73 S160 87 205 60 S260 72 302 46 S357 56 397 27 S442 36 480 13 L480 120 L0 120Z" fill="url(#priceLoginChart)" opacity=".12"/></svg><div className="price-login-signal-meta"><span><i/> Margin target protected</span><span>12 changes reviewed</span></div></div></div>
      <p className="price-login-footer">Supplier costs, margin review, and approval exports.</p>
    </section>
    <section className="price-login-access"><div className="price-login-card"><div className="price-login-card-mark">G</div><span className="price-login-eyebrow">Secure workspace access</span><h2>{step === 'email' ? 'Sign in to your workspace' : 'Check your inbox'}</h2><p className="muted">{step === 'email' ? 'Use your work email and we’ll send a secure, one-time code.' : `Enter the verification code sent to ${email}.`}</p>{!configured ? <div className="auth-notice">Supabase is not configured yet. Add the two <code>NEXT_PUBLIC_SUPABASE_*</code> variables locally or in Vercel.</div> : step === 'email' ? <form className="auth-form" onSubmit={sendCode}><label>Work email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required autoFocus /></label><button className="button primary" disabled={busy}>{busy ? 'Sending code…' : 'Send login code'}</button></form> : <form className="auth-form" onSubmit={verifyCode}><label>Verification code<input className="otp-input" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="000000" required autoFocus /></label><div className="auth-actions"><button className="button primary" disabled={busy}>{busy ? 'Verifying…' : 'Verify code'}</button><button className="text-button" type="button" onClick={() => { setStep('email'); setCode(''); }}>Start again</button></div></form>}{message && <p className="auth-message">{message}</p>}<div className="price-login-security"><span>◇</span><span><strong>Password-free access</strong><small>Secure one-time codes expire after use.</small></span></div></div></section>
  </main>;
}
