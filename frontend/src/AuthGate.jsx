import React, { useEffect, useState } from 'react';
import { Compass, Eye, EyeOff, LogOut, ArrowRight, FileText, Search, CheckCircle2 } from 'lucide-react';
import { supabase } from './supabase.js';
import App from './App.jsx';

export default function AuthGate() {
  const [session, setSession] = useState(null), [checking, setChecking] = useState(true);
  const [mode, setMode] = useState('login'), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState(''), [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const signup = mode === 'signup';
  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    const { data } = supabase.auth.onAuthStateChange((_, next) => { setSession(next); setChecking(false); });
    supabase.auth.getSession().then(({ data, error }) => { if (error) setError('Sesi tidak dapat dibaca. Silakan masuk kembali.'); setSession(data.session); setChecking(false); }).catch(() => { setChecking(false); setError('Koneksi akun gagal. Muat ulang halaman.'); });
    return () => data.subscription.unsubscribe();
  }, []);
  function changeMode(next) { setMode(next); setPassword(''); setConfirmation(''); setError(''); setMessage(''); setVisible(false); }
  async function authenticate(event) {
    event.preventDefault(); setError(''); setMessage('');
    if (signup && password.length < 8) { setError('Untuk daftar akun, gunakan password minimal 8 karakter.'); return; }
    if (signup && password !== confirmation) { setError('Konfirmasi password belum sama. Periksa kembali.'); return; }
    setBusy(true);
    try {
      const credentials = { email: email.trim(), password };
      const { error } = signup ? await supabase.auth.signUp(credentials) : await supabase.auth.signInWithPassword(credentials);
      if (error) {
        if (error.status === 429) throw new Error('Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.');
        if (error.code === 'email_not_confirmed') throw new Error('Konfirmasi email terlebih dahulu melalui tautan di kotak masuk atau folder spam.');
        throw new Error(signup ? 'Pendaftaran belum berhasil. Periksa email dan kekuatan password, lalu coba lagi.' : 'Email atau password tidak cocok. Periksa juga konfirmasi email akunmu.');
      }
      setPassword(''); setConfirmation('');
      if (signup) { setMode('login'); setMessage('Pendaftaran diproses. Periksa email dan folder spam untuk konfirmasi akun, lalu masuk di sini.'); }
    } catch (e) { setError(e.message || 'Koneksi gagal. Coba kembali.'); } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try { const { error } = await supabase.auth.signOut(); if (error) throw error; setSession(null); setMessage('Kamu sudah keluar dari akun.'); }
    catch { setError('Belum berhasil keluar. Periksa koneksi lalu coba lagi.'); }
    finally { setBusy(false); }
  }
  if (checking) return <main className="auth-loading" role="status">Memeriksa sesi akun…</main>;
  if (session) return <><div className="account-bar"><span>Akun: <strong>{session.user.email}</strong></span><button disabled={busy} onClick={logout}><LogOut size={15}/>Keluar</button>{error && <p role="alert">{error}</p>}</div><App key={session.user.id} session={session}/></>;
  return <main className="auth-page"><section className="auth-story"><a className="brand" href="/"><span className="prima-mark">P</span>Prima</a><div className="auth-intro"><h1>Rekomendasi magang<br/>berdasarkan skill kamu.</h1><p>Isi keterampilan atau unggah CV. Prima mencocokkannya dengan deskripsi pekerjaan, lalu menampilkan rekomendasi dan skill yang perlu kamu tinjau.</p><div className="auth-example"><span>Yang bisa kamu lakukan di Prima</span><ul><li>Mengisi profil keterampilan</li><li>Membandingkan kecocokan pekerjaan</li><li>Menyimpan hasil untuk dibaca lagi</li></ul></div></div><p className="auth-footnote">Prima adalah aplikasi penelitian. Data pekerjaan yang digunakan belum diverifikasi sebagai lowongan aktif.</p></section><section className="auth-form-area" aria-label="Akses akun"><div className="auth-form-card"><div className="auth-switch" role="group" aria-label="Pilih akses akun"><button aria-pressed={!signup} onClick={() => changeMode('login')} disabled={busy}>Masuk</button><button aria-pressed={signup} onClick={() => changeMode('signup')} disabled={busy}>Buat akun</button></div><h2>{signup ? 'Buat akun Prima' : 'Masuk ke Prima'}</h2><p className="auth-caption">{signup ? 'Gunakan email yang bisa kamu akses untuk konfirmasi akun.' : 'Gunakan akunmu untuk mengisi profil dan melihat rekomendasi.'}</p>{!supabase ? <p role="alert">Layanan akun belum dikonfigurasi. Silakan hubungi pengelola aplikasi.</p> : <form onSubmit={authenticate}><fieldset disabled={busy}><label htmlFor="auth-email">Email akun</label><input id="auth-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required/><label htmlFor="auth-password">Password</label><div className="password-field"><input id="auth-password" type={visible ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} aria-describedby={signup ? 'password-help' : undefined} required/><button type="button" aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{signup && <><p className="help" id="password-help">Gunakan minimal 8 karakter.</p><label htmlFor="auth-confirmation">Konfirmasi password</label><input id="auth-confirmation" type={visible ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} required/></>}{error && <p className="cv-error" role="alert">{error}</p>}{message && <p className="auth-message" role="status">{message}</p>}<button className="primary auth-submit" type="submit">{busy ? 'Sedang memproses…' : signup ? 'Daftar akun' : 'Masuk'}{!busy && <ArrowRight size={18}/>}</button></fieldset></form>}<p className="auth-privacy">CV disimpan privat. Kamu bisa menghapus file melalui Profil saya.</p></div></section></main>;
}
