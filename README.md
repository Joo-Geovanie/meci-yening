# Ruang Peran — Sistem Rekomendasi Magang

Prototipe lokal untuk mengeksplorasi peran berdasarkan keterampilan mahasiswa. Data berasal dari `batuhanmtl/job-skill-set`, bukan daftar magang aktif yang diverifikasi. Judul dan deskripsi sumber tidak diganti menjadi lowongan baru.

## Status yang benar-benar tersedia

- Data asli: 1.167 baris, 5 kolom, 0 null, 0 duplikat penuh; 25 judul intern/internship dan 37 judul dengan indikasi awal karier.
- Notebook EDA, preprocessing, TF-IDF + cosine, KNN pada skill biner, embedding MiniLM pretrained, contoh empat profil demonstrasi, evaluasi bersyarat, dan ekspor artefak.
- Backend FastAPI memuat artefak sekali; frontend React + Vite + Tailwind menyediakan profil, filter, hasil, alasan, deskripsi asli, dan simpanan browser.
- Form penilaian 100 pasangan dengan label kosong. Belum ada klaim Precision/Recall/NDCG atau model paling akurat.
- Akun/login, Supabase, dan deployment belum diaktifkan. Prototipe tidak menampilkan login palsu atau mengklaim data tersimpan lintas perangkat.

## Menjalankan aplikasi lokal

Dari terminal PowerShell pertama di folder proyek:

```powershell
Set-Location C:\Users\yosep\Documents\MECIN-LENING
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Di terminal kedua:

```powershell
Set-Location C:\Users\yosep\Documents\MECIN-LENING\frontend
npm run dev
```

Buka http://127.0.0.1:5173. Dokumentasi API: http://127.0.0.1:8000/docs.
Gunakan tombol contoh profil, klik **Jelajahi peran**, baca skill cocok, lalu buka deskripsi asli. Filter bawaan hanya judul intern/internship. Cakupan semua pekerjaan termasuk posisi senior, dan diberi keterangan yang sesuai.

Simpanan menggunakan localStorage browser, maksimal 50 peran. Skor tersimpan merupakan snapshot profil saat pencarian. Profil tidak dikirim ke layanan eksternal oleh aplikasi ini. Backend hanya mendengarkan loopback untuk prototipe lokal.

## Instalasi ulang

Lingkungan `.venv`, dependensi frontend, dan artefak sudah dibuat. Untuk mesin baru, gunakan Python 3.14 dan Node.js yang mendukung Vite 7:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Set-Location frontend
npm ci
```

Kembali ke root proyek. Untuk menjalankan seluruh notebook termasuk embedding, instal tambahan dengan `.\.venv\Scripts\python.exe -m pip install -r requirements-embedding.txt`. Buka notebook di VS Code (ekstensi Python dan Jupyter Microsoft), pilih kernel `.venv\Scripts\python.exe`, lalu **Run All** untuk membuat ulang artefak. Model embedding sudah disimpan lokal; pada mesin baru, sel embedding mengunduh revision yang dikunci. API dan frontend hanya membutuhkan dependensi dasar.

## Berkas dan arsitektur

```text
data/raw/                         snapshot sumber, tidak ditimpa
data/jobs_clean.csv               data turunan, dibuat notebook
data/evaluation/relevance_labels.csv  lembar penilaian manusia
notebook/machine_learning.ipynb   eksperimen dan output nyata
model/recommender.py              preprocessing, fitur, ranking bersama
model/evaluation.py               metrik setelah label lengkap
model/artifacts/recommender.joblib artefak inferensi lokal tepercaya
backend/main.py                  API FastAPI
frontend/src/                    antarmuka React
PRESENTASI.md                    panduan presentasi dan batas klaim
```

Alur: CSV → notebook → artefak → FastAPI → React. Logika rekomendasi dipakai bersama notebook dan backend, bukan disalin. API: `GET /health`, `GET /catalog`, `GET /jobs`, `POST /recommend`.

## Metodologi

TF-IDF menggabungkan judul, skill, dan deskripsi; profil berisi skill dan minat. Cosine similarity × 100 bukan peluang diterima. KNN menggunakan fitur biner skill sehingga berbeda dari TF-IDF teks. KNN pada fitur TF-IDF dan jarak cosine yang sama terbukti ekuivalen dengan pencarian cosine langsung. Filter kategori dan jenis kandidat berlaku sebelum ranking. Tidak ada bobot hybrid arbitrer.

Skill cocok memakai kesamaan persis setelah normalisasi kapitalisasi, Unicode, dan spasi. Sinonim belum digabung. Skill belum tercantum pada profil bukan bukti mahasiswa tidak menguasainya. `unknown_skills` bukan berarti istilah tidak pernah ada di deskripsi.

TF-IDF dipilih sementara untuk prototipe karena ringan dan mendukung minat teks. Pemilihan ini belum didukung evaluasi relevansi. KNN tetap tersedia sebagai pembanding.

Eksperimen ketiga menggunakan [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) pada CPU, tanpa fine-tuning. Model mengubah judul dan skill menjadi vektor 384 dimensi. Revision model dan urutan ID kandidat disimpan di `model/artifacts/metadata.json`. Embedding hanya menjadi eksperimen notebook, bukan metode API saat ini. Model pretrained dipakai sesuai batasannya; tidak diklaim sebagai algoritma baru.

## Evaluasi akademik

Isi `data/evaluation/relevance_labels.csv` oleh penilai manusia menggunakan rubrik dalam notebook: 0 tidak relevan, 1 relevan sebagian, 2 relevan/cukup sesuai. Wajib mengisi penilai dan alasan. Skrip menolak label hilang, pasangan duplikat, atau katalog penilaian yang tidak lengkap. File label tidak ditimpa saat Run All.

Empat profil saat ini adalah skenario demonstrasi buatan, bukan responden penelitian. Untuk penelitian final, gunakan profil mahasiswa berizin, penilaian independen, dan pemisahan kasus pengembangan/uji. Jangan membuat label dari skor model atau overlap skill. Coverage dan waktu inferensi tidak menggantikan evaluasi relevansi.

## Pengujian

```powershell
.\.venv\Scripts\python.exe -m pytest -q
Set-Location frontend
npm run build
```

Notebook juga dapat dieksekusi dari root proyek melalui `.\.venv\Scripts\python.exe run_notebook.py`. Output notebook disimpan hanya jika seluruh sel berhasil.

Pengujian mencakup filter, urutan ranking, kecocokan skill, input di luar kosakata, validasi API, penolakan label kosong, serta integritas data mentah. Notebook dieksekusi berurutan dan hasil disimpan. API dan proxy frontend telah diperiksa melalui HTTP. Pemeriksaan visual/interaksi browser belum berhasil karena runtime kontrol browser gagal diinisialisasi; build sukses bukan bukti audit visual selesai.

Hasil verifikasi 4 November 2026: 15 sel kode notebook berhasil dieksekusi, 8 pengujian lulus, `pip check` bersih, dan build frontend berhasil. Embedding kandidat berukuran 25 × 384; maksimum input 78 token dari batas 256, sehingga tidak ada pemotongan. Coverage pada empat profil demo: TF-IDF 68%, KNN 52%, embedding 64%. Angka coverage ini bukan akurasi atau dasar pemilihan model terbaik.

Untuk preview build, salin `frontend/.env.example` ke `frontend/.env` sebelum membangun, lalu `npm run build` dan `npm run preview`; backend tetap harus berjalan. Konfigurasi API build ini hanya untuk lokal, belum konfigurasi hosting.

## Integritas dataset

Sumber: https://huggingface.co/datasets/batuhanmtl/job-skill-set
Revision: `78e2e843eada1d3c901bc7fb123eaf2dc1c3c36f`.
`data/raw/` memuat Parquet asli, CSV utuh UTF-8, dataset card, dan metadata SHA-256. Konversi telah dibandingkan kembali dengan Parquet. `download_dataset.py` menggunakan mode tulis eksklusif dan menolak menimpa raw. Jalankan unduhan hanya pada salinan proyek tanpa berkas raw. Tidak perlu mengunduh ulang untuk menjalankan notebook.

Dataset card merujuk lisensi sumber Kaggle; jangan menganggap dataset ini berlisensi bebas tanpa memeriksa ketentuannya. Data tidak memiliki lokasi, perusahaan, URL lamaran, tanggal posting, atau level pengalaman terstruktur. Analisis dan alternatif tersedia dalam notebook.

## Tahap yang membutuhkan masukan berikutnya

1. Penilaian relevansi oleh manusia dan profil penelitian yang disetujui.
2. Validasi kandidat magang, konteks Indonesia, dan status lowongan jika produk akan dipakai untuk melamar.
3. Konfigurasi Supabase untuk akun, profil, dan riwayat lintas perangkat. `.env.example` hanya placeholder; belum ada koneksi atau perubahan database.
4. Deployment Railway hanya setelah diminta secara eksplisit dan konfigurasi produksi tersedia.
