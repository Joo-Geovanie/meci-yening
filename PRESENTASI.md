# Panduan presentasi

## Cerita utama (sekitar 7 menit)

1. **Masalah:** mahasiswa perlu melihat hubungan keterampilan yang dimiliki dengan peran kerja. Sistem memberi rekomendasi berbasis isi pekerjaan, bukan memprediksi diterima perusahaan.
2. **Data:** 1.167 pekerjaan dari Hugging Face, asal LinkedIn dan skill ekstraksi RecAI. Lima kategori relatif seimbang, tetapi hanya 25 judul menyebut intern/internship. Tidak ada jaminan lowongan masih aktif.
3. **EDA:** tunjukkan `head`, `info`, `shape`, null, duplikat, kategori, dan bukti kata kunci. Nol null bukan bukti data sepenuhnya benar. Contoh HR Manager menyebut intern karena tugasnya mengurus intern.
4. **Preprocessing:** simpan raw utuh, normalisasi pada salinan, baca list dengan `ast.literal_eval`, tandai kandidat dari judul. Jangan mengarang level, perusahaan, atau lokasi.
5. **Eksperimen:** TF-IDF memberi bobot kata khas; cosine mengukur kemiripan vektor. KNN skill biner mengambil pekerjaan dengan himpunan skill serupa. KNN dengan TF-IDF/cosine yang sama ekuivalen dengan cosine langsung; notebook membuktikannya. Status embedding ditunjukkan secara jujur di notebook.
6. **Demo:** jalankan backend dan frontend, gunakan contoh profil, cari peran, tunjukkan skor, skill cocok, skill belum tercantum, dan deskripsi asli. Filter hanya kandidat magang, lalu coba filter bidang. Simpan satu hasil untuk dibaca kembali di browser yang sama.
7. **Evaluasi dan batasan:** empat profil demo bukan responden penelitian. Form penilaian 100 pasangan menunggu manusia. Jangan menyebut skor kemiripan sebagai akurasi. Penilaian independen diperlukan untuk Precision@K, Recall@K, dan NDCG@K.

## Jawaban pertanyaan dosen

**Apakah ini membuat algoritma baru?** Tidak. Ini implementasi metode pencarian/rekomendasi berbasis konten dan perbandingan representasi fitur.

**Mengapa tidak ada train/test split acak pada pekerjaan?** Sistem membangun indeks katalog untuk retrieval, bukan classifier dengan target y. Evaluasi generalisasi memerlukan profil uji dan label relevansi yang terpisah dari pengembangan parameter. Split acak pekerjaan saja tidak membuat ground truth.

**Apa arti skor 20%?** Cosine similarity dikalikan 100 untuk tampilan. Bukan 20% peluang diterima, bukan 20% semua syarat terpenuhi. Skor antarrepresentasi tidak boleh disamakan sebagai ukuran kualitas terkalibrasi.

**Mengapa skill umum bisa mendominasi?** Communication dan problem solving sering muncul. KNN skill biner tidak membedakan kelangkaan skill. TF-IDF memberi bobot IDF tetapi masih punya keterbatasan kata/sinonim. Model perlu diuji, bukan dipilih hanya dari hasil contoh yang tampak bagus.

**Mengapa belum ada model terbaik?** Belum ada label relevansi manusia. TF-IDF dipakai sebagai pilihan operasional sementara karena ringan dan menerima minat teks; belum terbukti paling relevan.

**Apakah skill yang hilang benar-benar tidak dikuasai mahasiswa?** Tidak. Artinya skill pekerjaan belum tercantum pada profil yang diisi. Isi deskripsi perlu diperiksa untuk memisahkan syarat wajib dan tambahan.

**Bagaimana evaluasi nanti?** Penilai memberi label 0/1/2 berdasarkan seluruh informasi dan syarat, mencatat alasan serta identitas. Gunakan minimal dua penilai bila memungkinkan. Jangan menghasilkan label dari skor model. Recall hanya berlaku dalam katalog kandidat yang seluruhnya dinilai.

**Apa yang belum selesai untuk produksi?** Validasi lowongan, label evaluasi, akun dan riwayat melalui Supabase, audit antarmuka dalam browser, serta deployment. Tidak ada kredensial atau hasil eksperimen yang dikarang.

## Sebelum presentasi

- Jalankan Run All pada kernel proyek dan periksa tidak ada error.
- Jalankan pengujian dan build sesuai README.
- Buka dua terminal untuk API dan frontend, lalu coba profil contoh.
- Tampilkan keterbatasan secara eksplisit. Nama Summer 2024 pada hasil adalah bukti data historis, bukan lowongan baru.
- Jangan mengisi label secara asal untuk membuat metrik terlihat lengkap.
