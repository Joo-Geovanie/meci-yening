import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
const MAX_BYTES = 5_000_000;
const API = import.meta.env.VITE_API_URL || '/api';

export default function CvUpload({ onSkills, disabled }) {
  const [session, setSession] = useState(null), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [files, setFiles] = useState([]), [analysis, setAnalysis] = useState(null);
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_, next) => { setSession(next); if (!next) { setFiles([]); setAnalysis(null); } });
    return () => data.subscription.unsubscribe();
  }, []);
  async function listFiles(userId) {
    const { data, error } = await supabase.storage.from('cvs').list(userId, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw new Error('Daftar CV belum dapat dibaca. Periksa konfigurasi Storage.');
    setFiles(data || []);
  }
  useEffect(() => { if (session) listFiles(session.user.id).catch(e => setError(e.message)); }, [session?.user.id]);
  async function authenticate(signup) {
    setError(''); setMessage('');
    if (signup && password.length < 8) { setError('Untuk daftar akun, gunakan password minimal 8 karakter.'); return; }
    setBusy(true);
    try {
      const { error } = signup ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(signup ? 'Pendaftaran gagal. Periksa email dan gunakan password minimal 8 karakter.' : 'Gagal masuk. Periksa email, password, dan konfirmasi email akun.');
      setPassword(''); setMessage(signup ? 'Pendaftaran diproses. Jika konfirmasi email diaktifkan, periksa email lalu masuk.' : 'Berhasil masuk. CV tersimpan hanya untuk akunmu.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function upload(event) {
    const file = event.target.files[0]; event.target.value = '';
    if (!file) return;
    setError(''); setMessage(''); setAnalysis(null);
    if (!file.size || file.size > MAX_BYTES) { setError('CV harus berisi data dan maksimal 5 MB (5.000.000 byte).'); return; }
    const extension = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'txt'].includes(extension)) { setError('Pilih file PDF, DOCX, atau TXT.'); return; }
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error('Sesi berakhir. Silakan masuk kembali.');
      const response = await fetch(`${API}/cv?extension=${extension}`, { method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/octet-stream' }, body: file, signal: AbortSignal.timeout(60000) });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'CV gagal diproses.');
      setAnalysis(result); setMessage(result.message);
      await listFiles(session.user.id);
    } catch (e) { setError(e.name === 'TimeoutError' ? 'Permintaan terlalu lama. Muat ulang daftar CV sebelum mencoba lagi.' : e.message); }
    finally { setBusy(false); }
  }
  async function remove(name) {
    setBusy(true); setError('');
    try {
      const path = `${session.user.id}/${name}`;
      const { error } = await supabase.storage.from('cvs').remove([path]);
      if (error) throw error;
      if (analysis?.path === path) setAnalysis(null);
      await listFiles(session.user.id); setMessage('CV dihapus dari Supabase. Skill yang sudah dipakai pada profil dapat dihapus lewat reset profil.');
    } catch { setError('CV belum berhasil dihapus. Coba kembali.'); } finally { setBusy(false); }
  }
  return <section className="cv-panel" aria-label="Unggah CV"><h3>Mulai dari CV</h3><p className="help">PDF teks, DOCX, atau TXT Â· maksimal 5 MB per file. PDF scan belum didukung. CV disimpan privat di Supabase, bukan sebagai tautan publik.</p>
    {!supabase ? <p className="help">Unggah CV belum aktif: koneksi Supabase perlu dikonfigurasi. Kamu tetap bisa mengisi skill secara manual.</p> : <>
      {!session ? <form onSubmit={e => { e.preventDefault(); authenticate(e.nativeEvent.submitter?.value === "signup"); }}><fieldset disabled={busy || disabled}><label htmlFor="cv-email">Email akun</label><input id="cv-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required/><label htmlFor="cv-password">Password</label><input id="cv-password" type="password" autoComplete="current-password" aria-describedby="cv-password-help" value={password} onChange={e => setPassword(e.target.value)} required/><p id="cv-password-help" className="help">Untuk akun baru, password minimal 8 karakter.</p><div className="cv-actions"><button className="secondary" type="submit">Masuk</button><button className="secondary" type="submit" name="action" value="signup">Daftar akun</button></div></fieldset></form> : <>
        <p className="help">Masuk sebagai {session.user.email}</p><label htmlFor="cv-file">Unggah dan simpan CV</label><input id="cv-file" type="file" accept=".pdf,.docx,.txt" disabled={busy || disabled} onChange={upload}/><p className="help">Dengan mengunggah, kamu memilih menyimpan file ini di akunmu. Skill yang terdeteksi belum tentu menggambarkan kemampuanmu; tinjau dahulu.</p>
        {analysis && <div><p className="help">{analysis.detected_count} skill katalog terdeteksi{analysis.detected_count > 50 ? '; ditampilkan 50 pertama' : ''}.</p><div className="skill-tags">{analysis.skills.map(skill => <span key={skill}>{skill}</span>)}</div>{analysis.skills.length ? <button className="secondary" disabled={busy || disabled} onClick={() => { onSkills(analysis.skills); setMessage('Skill CV menggantikan skill profil. Hapus yang tidak sesuai, lalu klik Temukan peran saya.'); }}>Gunakan skill CV</button> : <p className="help">Belum ada skill katalog yang cocok persis. Isi manual; bahasa dan sinonim dapat memengaruhi deteksi.</p>}</div>}
        <details><summary>CV tersimpan ({files.length}{files.length === 100 ? '+' : ''})</summary><p className="help">Nama file diacak untuk menjaga privasi. Ditampilkan hingga 100 file terbaru.</p>{files.map(file => <div className="cv-file" key={file.name}><span>{new Date(file.created_at).toLocaleString('id-ID')} Â· {file.name.split('.').pop().toUpperCase()}</span><button className="text-button" disabled={busy} onClick={() => remove(file.name)}>Hapus</button></div>)}</details><div className="cv-actions"><button className="text-button" disabled={busy} onClick={() => listFiles(session.user.id).catch(e => setError(e.message))}>Muat ulang daftar</button><button className="text-button" disabled={busy} onClick={async () => { const { error } = await supabase.auth.signOut(); if (error) setError('Gagal keluar. Coba lagi.'); else setMessage('Keluar dari akun.'); }}>Keluar</button></div>
      </>}
    </>}{busy && <p role="status">Sedang memprosesâ€¦</p>}{message && <p className="help" role="status">{message}</p>}{error && <p className="cv-error" role="alert">{error}</p>}
  </section>;
}
