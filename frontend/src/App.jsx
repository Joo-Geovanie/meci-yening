import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bookmark, Check, Compass, Search, X, Plus, RotateCcw, SlidersHorizontal, Code2, Users, ChartNoAxesCombined, BriefcaseBusiness, Banknote, BookOpen, Info, Download, LoaderCircle } from 'lucide-react';

import CvUpload from './CvUpload.jsx';

const API = import.meta.env.VITE_API_URL || '/api';
const STORE = 'ruang-peran-saved-v1', DRAFT = 'ruang-peran-profile-v2';
const fields = {
  'INFORMATION-TECHNOLOGY': { name: 'Teknologi', icon: Code2, color: 'blue' },
  HR: { name: 'Human resources', icon: Users, color: 'rose' },
  FINANCE: { name: 'Keuangan', icon: Banknote, color: 'green' },
  SALES: { name: 'Penjualan', icon: ChartNoAxesCombined, color: 'amber' },
  'BUSINESS-DEVELOPMENT': { name: 'Pengembangan bisnis', icon: BriefcaseBusiness, color: 'purple' },
};
const presets = [
  { name: 'Teknologi', category: 'INFORMATION-TECHNOLOGY', skills: ['python', 'sql', 'data analysis'], interest: 'information technology' },
  { name: 'HR', category: 'HR', skills: ['communication', 'recruitment', 'microsoft office'], interest: 'human resources' },
  { name: 'Keuangan', category: 'FINANCE', skills: ['accounting', 'financial analysis', 'microsoft excel'], interest: 'finance accounting' },
];
const emptyProfile = { skills: [], interest: '', category: '', scope: 'internship', method: 'tfidf' };
function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function strings(value) { return Array.isArray(value) && value.every(s => typeof s === 'string'); }
function readProfile(userId) {
  const p = readJson(`${DRAFT}:${userId}`, null);
  if (!p || !strings(p.skills) || p.skills.length > 50 || p.skills.some(s => !s.trim() || s.length > 100)) return emptyProfile;
  return { skills: p.skills, interest: typeof p.interest === 'string' ? p.interest.slice(0, 500) : '', category: Object.hasOwn(fields, p.category) ? p.category : '', scope: ['internship', 'early_career', 'all'].includes(p.scope) ? p.scope : 'internship', method: p.method === 'knn' ? 'knn' : 'tfidf' };
}
function readSaved(userId) {
  const items = readJson(`${STORE}:${userId}`, []);
  return Array.isArray(items) ? items.filter(x => x && Number.isInteger(x.job_id) && typeof x.job_title === 'string' && typeof x.job_description === 'string' && Object.hasOwn(fields, x.category) && (x.score == null ? strings(x.skills) : Number.isFinite(x.score) && strings(x.matched_skills) && strings(x.missing_skills) && typeof x.explanation === 'string')).slice(0, 50) : [];
}
function signature(p) { return JSON.stringify({ ...p, skills: [...p.skills].sort() }); }
function skillsOf(job) { return job.skills || [...(job.matched_skills || []), ...(job.missing_skills || [])]; }
async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, { ...options, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(response.status === 422 ? 'Periksa kembali isian profilmu.' : 'Layanan belum tersedia. Coba lagi sebentar.');
  return response.json();
}

function RoleCard({ job, top, saved, onSave, onOpen }) {
  const field = fields[job.category], Icon = field.icon, scored = Number.isFinite(job.score);
  return <article className={`role-card ${top ? 'first-result' : ''}`}>
    <div className="role-top"><span className={`field-icon ${field.color}`}><Icon size={22}/></span><span className="field-name">{field.name}</span><button className={`icon-button bookmark ${saved ? 'is-saved' : ''}`} aria-label={`${saved ? 'Hapus simpanan' : 'Simpan'} ${job.job_title}`} aria-pressed={saved} onClick={() => onSave(job)}><Bookmark size={19} fill={saved ? 'currentColor' : 'none'}/></button></div>
    {top && <span className="top-label"><Check size={13}/>Skor tertinggi</span>}
    <h3><button onClick={() => onOpen(job)}>{job.job_title}</button></h3>
    <p className="role-meta">{job.internship_candidate ? 'Judul magang' : 'Peran umum'}<span>·</span>Arsip dataset</p>
    {scored ? <><div className="score-line"><span>Skor kemiripan</span><strong>{job.score.toFixed(1)}<small>%</small></strong></div><div className="score-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, job.score))}%` }}/></div><p className="match-caption">{job.matched_skills?.length || 0} skill cocok persis</p></> : <p className="preview-caption">Lengkapi profil untuk melihat kecocokanmu.</p>}
    <div className="skill-tags">{(scored ? job.matched_skills || [] : skillsOf(job)).slice(0, 3).map(s => <span key={s} className={scored ? 'matched' : ''}>{scored && <Check size={11}/>} {s}</span>)}{scored && !job.matched_skills?.length && <span>Belum ada skill yang cocok persis</span>}</div>
    <button className="detail-link" onClick={() => onOpen(job)}>Lihat detail <ArrowRight size={16}/></button>
  </article>;
}

function RoleDetail({ job, onClose, onSave, saved }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  const scored = Number.isFinite(job.score), field = fields[job.category], Icon = field.icon;
  return <dialog ref={dialog} className="detail-dialog" onCancel={onClose} onClose={onClose} aria-labelledby="detail-title" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="dialog-head"><span className={`field-icon ${field.color}`}><Icon size={24}/></span><span>{field.name}</span><button className="icon-button" onClick={onClose} aria-label="Tutup detail"><X size={22}/></button></div>
    <div className="dialog-body"><h2 id="detail-title">{job.job_title}</h2><p className="role-meta">Data historis · ID {job.job_id}</p><div className="context-note"><Info size={17}/><p>Peran dari arsip dataset. Status lowongan, perusahaan, dan lokasi belum diverifikasi.</p></div>
      {scored && <section className="detail-score"><div><span>Skor kemiripan</span><strong>{job.score.toFixed(1)}<small>%</small></strong></div><p>{job.explanation}<br/>Skor bukan peluang diterima atau persentase syarat yang terpenuhi.</p></section>}
      <h3>{scored ? 'Keterampilan yang sudah cocok' : 'Keterampilan dalam peran ini'}</h3><div className="skill-tags detail-tags">{(scored ? job.matched_skills || [] : skillsOf(job)).map(s => <span className={scored ? 'matched' : ''} key={s}>{s}</span>)}</div>{scored && !job.matched_skills?.length && <p className="muted">Belum ada kecocokan skill persis. Skor berasal dari kemiripan teks.</p>}
      {scored && <><h3>Skill yang belum ada di profil</h3><p className="help">Belum tercantum pada profilmu. Baca deskripsi untuk membedakan syarat wajib dan tambahan; ini bukan penilaian kemampuanmu.</p><div className="skill-tags detail-tags">{job.missing_skills.map(s => <span key={s}>{s}</span>)}</div></>}
      <details className="original-description"><summary>Deskripsi pekerjaan asli <BookOpen size={16}/></summary><p>{job.job_description}</p></details>
    </div><div className="dialog-footer"><button className="secondary" onClick={onClose}>Kembali</button><button className="primary" onClick={() => onSave(job)}><Bookmark size={17}/>{saved ? 'Hapus dari simpanan' : 'Simpan peran'}</button></div>
  </dialog>;
}

export default function App({ session }) {
  const STORE = `ruang-peran-saved-v1:${session.user.id}`, DRAFT = `ruang-peran-profile-v2:${session.user.id}`;
  const [profile, setProfile] = useState(() => readProfile(session.user.id));
  const [catalog, setCatalog] = useState(null), [catalogLoading, setCatalogLoading] = useState(true);
  const [skillText, setSkillText] = useState(''), [result, setResult] = useState(null), [searched, setSearched] = useState(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(() => readSaved(session.user.id)), [view, setView] = useState('profile'), [selected, setSelected] = useState(null);
  const [browseField, setBrowseField] = useState(''), [more, setMore] = useState(false), [query, setQuery] = useState('');
  const resultsRef = useRef(null), skillInput = useRef(null);
  function update(values) { setProfile(p => ({ ...p, ...values })); }
  useEffect(() => { try { localStorage.setItem(DRAFT, JSON.stringify(profile)); } catch { /* Pencarian tetap berfungsi tanpa localStorage. */ } }, [profile]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(timer); }, [notice]);
  async function loadCatalog() {
    setCatalogLoading(true); setError('');
    try { setCatalog(await request('/catalog')); }
    catch { setError('Data pekerjaan belum bisa dimuat. Periksa koneksi lalu coba lagi.'); }
    finally { setCatalogLoading(false); }
  }
  useEffect(() => { loadCatalog(); }, []);
  function addSkills(values) {
    const next = [...new Set([...profile.skills, ...values.map(s => s.trim().toLowerCase()).filter(Boolean)])];
    if (next.length > 50 || next.some(s => s.length > 100)) { setError('Maksimal 50 skill, masing-masing hingga 100 karakter.'); return; }
    update({ skills: next }); setSkillText(''); setError('');
  }
  async function search(event) {
    event.preventDefault();
    const skills = [...new Set([...profile.skills, ...skillText.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)])];
    if (!skills.length) { setError('Tambahkan setidaknya satu keterampilan.'); skillInput.current.focus(); return; }
    if (skills.length > 50 || skills.some(s => s.length > 100)) { setError('Maksimal 50 skill, masing-masing hingga 100 karakter.'); return; }
    const snapshot = { ...profile, skills };
    setProfile(snapshot); setSkillText(''); setLoading(true); setError('');
    try {
      const data = await request('/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...snapshot, category: snapshot.category || null, k: 5 }) });
      setResult(data); setSearched(snapshot); setView('explore'); setQuery('');
      if (window.innerWidth < 850) resultsRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    } catch (e) { setError(e.name === 'TimeoutError' ? 'Pencarian terlalu lama. Coba lagi.' : e.message === 'Failed to fetch' ? 'Koneksi layanan terputus. Periksa backend, lalu coba lagi.' : e.message); }
    finally { setLoading(false); }
  }
  function toggleSave(job) {
    const exists = saved.some(s => s.job_id === job.job_id);
    if (!exists && saved.length >= 50) { setError('Simpanan sudah berisi 50 peran. Hapus salah satu sebelum menambah.'); return; }
    const next = exists ? saved.filter(s => s.job_id !== job.job_id) : [{ ...job, saved_at: new Date().toISOString() }, ...saved];
    try { localStorage.setItem(STORE, JSON.stringify(next)); setSaved(next); setNotice(exists ? 'Peran dihapus dari simpanan.' : 'Peran disimpan di browser ini.'); }
    catch { setError('Penyimpanan browser tidak tersedia atau penuh.'); }
  }
  function downloadSaved() {
    const blob = new Blob([JSON.stringify({ note: 'Arsip peran historis, bukan lowongan aktif. Skor adalah snapshot saat disimpan.', roles: saved }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'prima-simpanan.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const stale = result && (signature(profile) !== signature(searched) || skillText.trim());
  const suggested = skillText.trim() ? (catalog?.skills || []).filter(s => s.includes(skillText.trim().toLowerCase()) && !profile.skills.includes(s)).slice(0, 6) : (catalog?.suggested_skills || []).filter(s => !profile.skills.includes(s)).slice(0, 5);
  const preview = (catalog?.preview_jobs || []).filter(job => !browseField || job.category === browseField);
  const baseItems = view === 'saved' ? saved : result ? result.results : preview;
  const filtered = baseItems.filter(job => job.job_title.toLowerCase().includes(query.toLowerCase()) || fields[job.category].name.toLowerCase().includes(query.toLowerCase()));
  const ordered = !browseField && !query ? [...Object.keys(fields).map(c => filtered.find(j => j.category === c)).filter(Boolean), ...filtered.filter(j => j !== filtered.find(x => x.category === j.category))] : filtered;
  const items = view === 'explore' && !result ? (more ? ordered : ordered.slice(0, 6)) : filtered;
  return <>
    <a className="skip-link" href="#workspace">Lewati ke pencarian</a>
    <header className="masthead"><a className="brand" href="#" onClick={() => setView('profile')}><img className="brand-logo" src="/prima-logo.png" alt="Prima" width="180" height="60"/></a><nav aria-label="Navigasi utama">{[['profile', 'Profil saya'], ['explore', 'Rekomendasi'], ['saved', 'Tersimpan'], ['guide', 'Tentang Prima']].map(([key, label]) => <button key={key} className={view === key ? 'active' : ''} aria-current={view === key ? 'page' : undefined} onClick={() => { setView(key); setQuery(''); }}>{label}{key === 'saved' && saved.length > 0 && <span className="nav-count">{saved.length}</span>}</button>)}</nav></header>
    <main>
      <section className="page-heading"><div><p>Rekomendasi magang</p><h1>{view === 'profile' ? 'Lengkapi profil kamu' : view === 'saved' ? 'Pekerjaan tersimpan' : view === 'guide' ? 'Tentang Prima' : 'Temukan pekerjaan yang sesuai'}</h1><p>{view === 'profile' ? 'Unggah CV atau isi skill secara manual. Periksa isianmu sebelum mencari rekomendasi.' : view === 'guide' ? 'Cara kerja, sumber data, dan batasan hasil rekomendasi.' : 'Baca deskripsi pekerjaan dan bandingkan skill yang diminta dengan profilmu.'}</p></div>{view === 'explore' && <button className="secondary" onClick={() => setView('profile')}>Edit profil</button>}</section>
      {view !== 'profile' && view !== 'guide' && <div className="dataset-note"><Info size={17}/><p>Data penelitian, bukan daftar lowongan aktif. Periksa kembali ketersediaan pekerjaan sebelum melamar.</p></div>}
      {error && <div className="alert" role="alert">{error}{!catalog && <button onClick={loadCatalog}>Coba lagi</button>}<button className="icon-button" onClick={() => setError('')} aria-label="Tutup pesan"><X size={16}/></button></div>}
      <div className="toast" role="status" aria-live="polite" hidden={!notice}><Check size={16}/>{notice}</div>
      {view === 'guide' ? <section className="guide" id="workspace"><div><p className="hero-kicker">Penelitian</p><h2>Pengembangan Sistem Rekomendasi Magang Berbasis Machine Learning Menggunakan Klasifikasi Teks dan Content-Based Filtering</h2><p className="muted">Kenali asal data, arti skor, dan batas kemampuan sistem.</p></div><div className="guide-content">{[
        ['Mulai dari keterampilan', 'Masukkan skill yang memang kamu miliki. Contoh profil hanya skenario demonstrasi. Profil disimpan di browser ini dan bisa dikosongkan lewat tombol reset.'],
        ['Baca skor dengan konteks', 'CV dibaca untuk mendeteksi skill persis dalam katalog; teks lengkap CV tidak dipakai untuk pemeringkatan. TF-IDF mengukur kemiripan teks skill yang telah ditinjau dan minat dengan pekerjaan. Persentase adalah cosine similarity dikali 100, bukan persentase syarat terpenuhi. KNN membandingkan kehadiran skill persis. Skor bukan peluang diterima atau persentase syarat yang terpenuhi. Penilaian relevansi manusia belum lengkap, sehingga belum ada klaim model paling akurat.'],
        ['Periksa detail perannya', 'Skill yang belum tercantum bukan berarti kamu tidak menguasainya. Baca deskripsi untuk mengecek pengalaman, pendidikan, dan syarat wajib. Lokasi belum dapat menjadi filter karena tidak tersedia secara terstruktur dan tervalidasi.'],
        ['Ketahui batas dataset', `Ada 1.167 pekerjaan umum, dengan ${catalog?.internship_candidates ?? 25} judul intern/internship. Status aktif belum diverifikasi. Perusahaan, lokasi, tanggal posting, dan URL lamaran belum tersedia sebagai kolom terstruktur.`],
        ['Simpanan milik browser ini', 'Skor tersimpan mengikuti profil saat pencarian. Mengubah profil tidak menghitung ulang simpanan. Simpanan peran tetap lokal; akun Supabase digunakan untuk CV privat. Kamu bisa mengunduh simpanan sebagai JSON.'],
      ].map(([title, text], i) => <article key={title}><span>{String(i + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}<a className="source-link" href="https://huggingface.co/datasets/batuhanmtl/job-skill-set" target="_blank" rel="noreferrer">Buka dataset asli <ArrowUpRight size={16}/></a></div></section> : <div id="workspace" className="workspace" data-view={view}>
        <aside className="profile-panel" hidden={view !== 'profile'}><div className="panel-title"><span className="profile-symbol"><Users size={20}/></span><div><h2>Profil keterampilan</h2><p>Isi sesuai kemampuan dan pengalamanmu.</p></div><button className="icon-button" aria-label="Reset profil" disabled={loading} onClick={() => { setProfile(emptyProfile); setSkillText(''); setNotice('Profil dikosongkan.'); }}><RotateCcw size={16}/></button></div>
          <CvUpload session={session} disabled={loading} onSkills={skills => { update({ skills, method: "tfidf" }); setSkillText(""); }}/><form onSubmit={search}><h3 className="manual-title">Isi keterampilan</h3><p className="help">Tambahkan skill sendiri atau periksa skill yang terbaca dari CV.</p><fieldset disabled={loading}><details className="profile-examples"><summary>Isi contoh profil untuk mencoba aplikasi</summary><div className="presets">{presets.map(p => <button type="button" key={p.name} onClick={() => { update({ skills: p.skills, interest: p.interest, category: p.category }); setSkillText(''); }}>{p.name}</button>)}</div></details>
            <label htmlFor="skill">Keterampilan <span>{profile.skills.length}/50</span></label><div className="skill-input"><Search size={16}/><input ref={skillInput} id="skill" value={skillText} maxLength={500} onChange={e => setSkillText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkills(skillText.split(',')); } }} placeholder="Cari skill, misalnya Python" autoComplete="off"/><button type="button" className="icon-button" aria-label="Tambahkan skill" onClick={() => addSkills(skillText.split(','))}><Plus size={18}/></button></div>
            <p className="help">Enter untuk menambah. Pisahkan beberapa skill dengan koma.</p><div className="selected-skills">{profile.skills.map(s => <span key={s}>{s}<button type="button" aria-label={`Hapus skill ${s}`} onClick={() => update({ skills: profile.skills.filter(x => x !== s) })}><X size={13}/></button></span>)}</div>
            {catalog && <div className="suggestions"><small>{skillText ? 'Ditemukan di katalog' : 'Sering muncul di kandidat magang'}</small><div>{suggested.map(s => <button type="button" key={s} onClick={() => addSkills([s])}><Plus size={11}/>{s}</button>)}{skillText && !suggested.length && <p className="help">Belum ada istilah persis. Kamu tetap bisa menambahkannya.</p>}</div></div>}
            <label htmlFor="interest">Minat karier <small>opsional</small></label><input id="interest" value={profile.interest} maxLength={500} onChange={e => update({ interest: e.target.value })} placeholder="Contoh: software development"/><p className="help">Gunakan istilah Inggris sesuai bahasa dataset.</p>
            <label htmlFor="category">Bidang yang ingin dijelajahi</label><select id="category" value={profile.category} onChange={e => update({ category: e.target.value })}><option value="">Semua bidang</option>{Object.entries(fields).map(([key, field]) => <option key={key} value={key}>{field.name}</option>)}</select>
            <details className="search-options"><summary><SlidersHorizontal size={14}/>Atur cakupan & metode</summary><label htmlFor="scope">Cakupan</label><select id="scope" value={profile.scope} onChange={e => update({ scope: e.target.value })}><option value="internship">Judul intern / internship</option><option value="early_career">Termasuk trainee & entry-level</option><option value="all">Semua peran, termasuk senior</option></select><label htmlFor="method">Metode pencocokan</label><select id="method" value={profile.method} onChange={e => update({ method: e.target.value })}><option value="tfidf">TF-IDF: skill & minat teks</option><option value="knn">KNN: skill persis</option></select><p className="help">Minat teks tidak digunakan oleh KNN.</p></details>
            <button type="submit" className="primary search-button" disabled={!catalog || loading}>{loading ? <LoaderCircle className="spin" size={18}/> : <Compass size={18}/>} {loading ? 'Mencari kecocokan…' : stale ? 'Perbarui rekomendasi' : 'Cari rekomendasi'}<ArrowRight size={17}/></button></fieldset>
          </form><div className="local-note"><i className="status-dot"/><span>Profil tersimpan otomatis di browser ini.</span></div>
        </aside>
        <section ref={resultsRef} hidden={view === 'profile'} className="results" aria-busy={loading || catalogLoading}><div className="results-heading"><div><p className="section-kicker">{view === 'saved' ? 'Simpanan' : result ? 'Hasil pencocokan' : 'Katalog pekerjaan'}</p><h2>{view === 'saved' ? 'Peran tersimpan' : result ? 'Rekomendasi untukmu' : 'Mulai jelajahi peran'}</h2></div>{view === 'saved' && saved.length > 0 ? <button className="secondary download" onClick={downloadSaved}><Download size={15}/>Unduh</button> : result && view === 'explore' ? <button className="text-button" onClick={() => { setResult(null); setQuery(''); }}>Lihat katalog</button> : <span className="catalog-total">{catalog?.internship_candidates ?? '0'} peran magang dalam katalog</span>}</div>
          <p className="results-subtitle">{view === 'saved' ? 'Skor mengikuti profil saat disimpan, bukan profil yang baru diubah.' : result ? `${result.results.length} hasil dari ${result.candidate_count} kandidat. Kemiripan bukan peluang diterima.` : 'Contoh peran asli dari dataset. Belum diurutkan berdasarkan kecocokan denganmu.'}</p>
          {stale && view === 'explore' && <div className="stale-note"><RotateCcw size={16}/><span>Profil berubah. Hasil masih memakai profil sebelumnya.</span><button onClick={search} disabled={loading}>Perbarui</button></div>}
          {result?.unknown_skills?.length > 0 && view === 'explore' && <details className="unknown-note"><summary>{result.unknown_skills.length} skill belum cocok persis dengan katalog</summary><p>{result.unknown_skills.join(', ')}. Periksa ejaan atau pilih saran katalog. Istilah ini masih mungkin cocok dalam teks deskripsi.</p></details>}
          {!result && view === 'explore' && <div className="field-filters" role="group" aria-label="Filter katalog"><button aria-pressed={!browseField} className={!browseField ? 'active' : ''} onClick={() => { setBrowseField(''); setMore(false); }}>Semua bidang</button>{Object.entries(fields).map(([key, field]) => <button key={key} aria-pressed={browseField === key} className={browseField === key ? 'active' : ''} onClick={() => { setBrowseField(key); setMore(false); }}>{field.name}<span>{catalog?.category_counts?.[key] ?? '0'}</span></button>)}</div>}
          <div className="list-toolbar"><span>{items.length} peran ditampilkan</span><div><Search size={14}/><input aria-label="Cari judul peran" placeholder="Cari judul peran…" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button className="icon-button" onClick={() => setQuery('')} aria-label="Hapus pencarian judul"><X size={14}/></button>}</div></div>
          {catalogLoading ? <div className="role-grid">{[1, 2, 3, 4].map(i => <div className="skeleton" key={i} aria-hidden="true"><span/><span/><span/></div>)}</div> : <div className={`role-grid ${loading ? 'is-loading' : ''}`}>{items.map((job, i) => <RoleCard key={job.job_id} job={job} top={view === "explore" && result?.results[0]?.job_id === job.job_id} onOpen={setSelected} onSave={toggleSave} saved={saved.some(s => s.job_id === job.job_id)}/>)}</div>}
          {!catalogLoading && !items.length && <div className="empty-state">{view === 'saved' ? <Bookmark size={36}/> : <Search size={36}/>}<h3>{view === 'saved' && !query ? 'Belum ada peran yang disimpan' : 'Belum menemukan peran yang sesuai'}</h3><p>{query ? 'Coba kata lain atau kosongkan pencarian judul.' : view === 'saved' ? 'Tandai peran yang menarik untuk membacanya lagi nanti.' : result?.message || 'Coba bidang lain atau hubungkan ulang katalog.'}</p><button className="secondary" onClick={() => { if (query) setQuery(''); else { setView('explore'); setResult(null); setBrowseField(''); } }}>{query ? 'Kosongkan pencarian' : 'Jelajahi katalog'}</button></div>}
          {!result && view === 'explore' && !more && ordered.length > 6 && <button className="load-more secondary" onClick={() => setMore(true)}>Lihat semua {ordered.length} peran <ArrowRight size={15}/></button>}
          <p className="results-footnote">Skor mengukur kemiripan dengan profil, bukan peluang diterima. Skill yang belum ada di profil bisa kamu tambahkan jika memang kamu kuasai.</p>
        </section>
      </div>}
      <footer><strong>Prima</strong><span>Sistem rekomendasi magang untuk penelitian</span><a href="https://huggingface.co/datasets/batuhanmtl/job-skill-set" target="_blank" rel="noreferrer">Sumber data <ArrowUpRight size={14}/></a></footer>
    </main>
    {selected && <RoleDetail job={selected} onClose={() => setSelected(null)} onSave={toggleSave} saved={saved.some(s => s.job_id === selected.job_id)}/>}
  </>;
}
