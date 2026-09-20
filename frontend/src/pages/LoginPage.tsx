// SPDX-License-Identifier: GPL-3.0-or-later

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '../config/app';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, isDemoAuthEnabled } from '../config/demoAuth';
import ReleaseNotesDialog from '../components/ReleaseNotesDialog';
import { GlassButton } from '../components/ui/glass-button';
import { GlassCard } from '../components/ui/glass-card';
import { GlassInput } from '../components/ui/glass-input';

export type LoginPageProps = {
  onLogin: (username: string, password: string, turnstileToken?: string) => Promise<void>;
};

type TurnstileOptions = {
  sitekey: string;
  action: string;
  size: 'flexible';
  appearance: 'always';
  theme: 'light';
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || '';

function demoRoleLabel(role: (typeof DEMO_ACCOUNTS)[number]['role']): string {
  return role === 'super_admin' ? 'Administrator' : role;
}

function LoginSymbol(props: React.SVGProps<SVGSVGElement>) {
  return <svg
    className="login-symbol"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  />;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetRef = useRef<string | null>(null);
  const turnstileTokenRef = useRef('');

  useEffect(() => {
    const container = turnstileContainerRef.current;
    if (!turnstileSiteKey || !container) return undefined;

    const api = () => (window as TurnstileWindow).turnstile;
    const renderWidget = () => {
      const currentApi = api();
      if (!currentApi || turnstileWidgetRef.current) return;
      turnstileWidgetRef.current = currentApi.render(container, {
        sitekey: turnstileSiteKey,
        action: 'login',
        size: 'flexible',
        appearance: 'always',
        theme: 'light',
        callback: (token) => {
          turnstileTokenRef.current = token;
          setTurnstileToken(token);
          setError('');
        },
        'expired-callback': () => {
          turnstileTokenRef.current = '';
          setTurnstileToken('');
        },
        'error-callback': () => {
          turnstileTokenRef.current = '';
          setTurnstileToken('');
          setError('Verifikasi keamanan belum siap. Coba lagi.');
        }
      });
    };

    let script = document.getElementById('cloudflare-turnstile') as HTMLScriptElement | null;
    const createdScript = !script;
    if (!script) {
      script = document.createElement('script');
      script.id = 'cloudflare-turnstile';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
    const handleLoad = () => renderWidget();
    const handleError = () => setError('Verifikasi keamanan gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.');
    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);
    renderWidget();

    return () => {
      script?.removeEventListener('load', handleLoad);
      script?.removeEventListener('error', handleError);
      if (turnstileWidgetRef.current) api()?.remove(turnstileWidgetRef.current);
      turnstileWidgetRef.current = null;
      turnstileTokenRef.current = '';
      setTurnstileToken('');
      if (createdScript) script?.remove();
    };
  }, []);

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>('[data-react-login-username]');
    input?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!licenseOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLicenseOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [licenseOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (turnstileSiteKey && !turnstileTokenRef.current) {
      setError('Selesaikan verifikasi keamanan sebelum masuk.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onLogin(username.trim(), password, turnstileTokenRef.current || undefined);
    } catch (cause) {
      console.error('Gagal masuk:', cause);
      setError(cause instanceof Error ? cause.message : 'Tidak dapat masuk ke aplikasi.');
      if (turnstileWidgetRef.current) {
        (window as TurnstileWindow).turnstile?.reset(turnstileWidgetRef.current);
        turnstileTokenRef.current = '';
        setTurnstileToken('');
      }
      setSubmitting(false);
    }
  };

  return <div className="login-shell">
    {releaseNotesOpen ? <ReleaseNotesDialog onClose={() => setReleaseNotesOpen(false)} /> : null}
    {licenseOpen ? <div className="release-notes-backdrop is-visible" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLicenseOpen(false); }}>
      <section className="release-notes-dialog login-license-dialog" role="dialog" aria-modal="true" aria-labelledby="react-login-license-title" aria-describedby="react-login-license-description">
        <header className="release-notes-header">
          <div className="release-notes-title-group">
            <span className="release-notes-logo"><img src="/logo-puskesmas-32981.svg" alt="" width={40} height={40} loading="lazy" decoding="async" /></span>
            <div>
              <p className="release-notes-eyebrow">E-Posyandu Open Source</p>
              <h2 id="react-login-license-title">Lisensi GNU GPL v3</h2>
            </div>
          </div>
          <button type="button" className="release-notes-close" onClick={() => setLicenseOpen(false)} aria-label="Tutup keterangan lisensi">×</button>
        </header>
        <div className="release-notes-scroll login-license-scroll">
          <section className="release-current" id="react-login-license-description">
            <div className="release-current-heading">
              <div>
                <span className="release-current-label">Open source · Copyleft</span>
                <h3>E-Posyandu dilisensikan di bawah GNU General Public License v3.0 atau yang lebih baru.</h3>
              </div>
            </div>
            <p className="login-license-lead">Lisensi ini menjaga agar setiap versi turunan yang dibagikan tetap menyediakan kebebasan yang sama bagi penggunanya.</p>
          </section>
          <section className="login-license-section" aria-labelledby="react-login-license-rights">
            <h3 id="react-login-license-rights">Hak yang diberikan</h3>
            <ul>
              <li>Menjalankan program untuk tujuan apa pun.</li>
              <li>Mempelajari dan mengubah kode sumber.</li>
              <li>Membuat serta membagikan salinan program.</li>
              <li>Membagikan versi modifikasi dengan lisensi GPL v3 yang sama.</li>
            </ul>
          </section>
          <p className="login-license-note"><strong>Saat mendistribusikan turunan:</strong> sertakan teks lisensi, pemberitahuan hak cipta, dan kode sumber terkait. GPL v3 tidak memberikan jaminan dan tidak melarang penggunaan komersial; kewajiban utamanya adalah mempertahankan kebebasan tersebut ketika perangkat lunak dibagikan.</p>
        </div>
        <footer className="release-notes-actions login-license-actions">
          <a className="login-license-link" href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noreferrer">Baca teks GPL v3 lengkap</a>
          <button type="button" className="release-notes-done" onClick={() => setLicenseOpen(false)}>Tutup</button>
        </footer>
      </section>
    </div> : null}
    <div className="login-batik-background" aria-hidden="true" />
    <main className="login-stage">
      <div className="login-stack">
        <GlassCard className="login-glass-card" glowEffect={false} aria-labelledby="react-login-title">
          <div className="login-brand">
            <div className="login-logo-shell">
              <img src="/logo-puskesmas-32981.svg" alt="Logo Puskesmas Demo" className="h-11 w-11 object-contain" width={44} height={44} loading="eager" decoding="async" />
            </div>
            <h1 id="react-login-title" className="login-title">E-Posyandu</h1>
            <p className="login-organization">Puskesmas Demo</p>
            <div className="login-brand-rule" aria-hidden="true"><span /><span /><span /></div>
          </div>
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <span>Username</span>
              <GlassInput
                data-react-login-username="true"
                required
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                glowOnFocus={false}
              />
            </label>
            <div className="login-field">
              <label htmlFor="react-login-password">Kata Sandi</label>
              <div className="login-password-field">
                <GlassInput
                  id="react-login-password"
                  required
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  glowOnFocus={false}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  title={passwordVisible ? 'Sembunyikan kata sandi' : 'Perlihatkan kata sandi'}
                  aria-label={passwordVisible ? 'Sembunyikan kata sandi' : 'Perlihatkan kata sandi'}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                >
                  {passwordVisible ? <LoginSymbol width={18} height={18} strokeWidth={1.8}>
                    <path d="M4.2 8.55C3.05 9.65 2.5 12 2.5 12s3.45 5.75 9.5 5.75c1.35 0 2.6-.28 3.7-.72M8.1 6.7A10.6 10.6 0 0 1 12 6.25c6.05 0 9.5 5.75 9.5 5.75a12 12 0 0 1-2.05 2.8" />
                    <path d="M9.8 9.75a3.05 3.05 0 0 0 4.45 4.4M3.2 3.2l17.6 17.6" />
                  </LoginSymbol> : <LoginSymbol width={18} height={18} strokeWidth={1.8}>
                    <path d="M2.5 12s3.45-5.75 9.5-5.75S21.5 12 21.5 12s-3.45 5.75-9.5 5.75S2.5 12 2.5 12Z" />
                    <circle cx="12" cy="12" r="2.75" />
                  </LoginSymbol>}
                </button>
              </div>
            </div>
            <div ref={turnstileContainerRef} className="login-turnstile" hidden={!turnstileSiteKey} />
            {error ? <p role="alert" className="login-error">{error}</p> : null}
            <GlassButton data-submit="true" type="submit" variant="primary" className="login-submit" wrapperClassName="w-full" glowEffect={false} disabled={submitting || Boolean(turnstileSiteKey && !turnstileToken)}>
              <span data-submit-label="true">{submitting ? 'Memproses...' : 'Masuk'}</span>
            </GlassButton>
          </form>
          {isDemoAuthEnabled() ? <aside className="login-demo-credentials" aria-label="Kredensial akun demo">
            <div className="login-demo-heading">
              <strong>Akun demo lokal</strong>
              <span>Mode development</span>
            </div>
            <p className="login-demo-password">Kata sandi semua akun: <code>{DEMO_PASSWORD}</code></p>
            <ul className="login-demo-account-list">
              {DEMO_ACCOUNTS.map((account) => <li key={account.key}>
                <code>{account.key}</code>
                <span>{demoRoleLabel(account.role)}</span>
              </li>)}
            </ul>
            <p className="login-demo-hint">Masukkan salah satu username di atas untuk mencoba aplikasi.</p>
            <button type="button" className="login-license-open" onClick={() => setLicenseOpen(true)} aria-haspopup="dialog">Lihat keterangan lisensi GNU GPL v3</button>
          </aside> : null}
        </GlassCard>
      </div>
    </main>
    <footer className="login-footer">
      <p>E-Posyandu · GNU GPL v3.0</p>
      <button
        type="button"
        className="app-version-button login-version-button"
        aria-haspopup="dialog"
        title="Lihat apa yang baru"
        onClick={() => setReleaseNotesOpen(true)}
      >E-Posyandu v{APP_VERSION}</button>
    </footer>
  </div>;
}
