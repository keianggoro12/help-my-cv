# Help My CV — Product Requirements Document

Status: fase 1 selesai, fase 2 belum mulai
Terakhir diperbarui: 5 Oktober 2026
Repo: https://github.com/keianggoro12/help-my-cv

---

## 1. Ringkasan

Help My CV adalah aplikasi web untuk membuat dan menyimpan CV. Satu orang bisa punya banyak CV, satu untuk tiap lamaran yang berbeda, dan semuanya tersimpan di satu akun. Aplikasi ini tidak menasihati karier, tidak menulis surat lamaran, dan tidak menilai kamu. Dia hanya menyimpan dan menyusun CV.

Tagline: "We only help your CV, not your career."

Pasar sasaran awal Indonesia, karena di sana istilah CV dan resume dipakai bergantian dan orang tidak tahu bedanya. Aplikasi ini memakai istilah CV saja.

---

## 2. Masalah yang diselesaikan

Kalau kamu melamar ke banyak tempat, kamu punya banyak CV. Sekarang file-file itu hidup di folder Downloads dengan nama seperti `CV_2024_final_v2.pdf` yang tidak kamu ingat lagi. Setiap perusahaan mau format CV sedikit berbeda, jadi kamu edit ulang file yang sama berulang kali.

Yang hilang:

- tempat yang stabil untuk menyimpan semua versi
- cara memuat data pribadi sekali, lalu memakainya di semua CV
- cara menampilkan hanya bagian yang relevan untuk lamaran tertentu

Help My CV menyimpan datanya sendiri, sekali. Tiap CV punya salinan dan kamu bebas mengubah salah satunya tanpa menyentuh yang lain.

---

## 3. Pengguna

### 3.1 Pengguna utama

Orang yang sedang aktif melamar kerja dan punya lebih dari satu CV. Buttuh cepat menyimpan perubahan, tidak perlu install apa pun, dan tidak mau daftar ulang akun untuk tiap lamaran.

### 3.2 Admin

Pemilik produk. Masuk ke area admin untuk melihat semua akun dan semua CV, mengedit CV milik orang lain, menghapus, dan mengubah role. Akun superadmin disiapkan lewat migrasi `0003_superadmin.sql` dan `0008_superadmin_admin_password.sql`, password-nya tidak ditulis di dokumen ini.

---

## 4. Cakupan fase 1 (selesai)

### 4.1 Halaman pemasaran

Route `/`. Berisi nama brand, tagline, subtitle, dua tombol (Log in, Sign up), link kecil ke login admin, tiga kartu penjelasan, dan navbar pill di atas.

Tambahan: lapisan gradient yang mengikuti mouse dengan efek glass. Dua lapisan radial gradient diposisikan di tengah viewport dan bergerak mengikuti kursor dengan transisi CSS. Di light mode warna intinya `#30394b` (abu-abu dingin yang mengambil cahaya dari latar putih), di dark mode kebalikannya: slate pucat yang menambahkan cahaya ke latar gelap. Kartu penjelasan memakai `backdrop-filter` supaya gradient terlihat menembus panel.

### 4.2 Akun dan sesi

Register, login, logout, dan pembacaan sesi. Sesi berupa token acak yang disimpan di tabel `sessions`, bukan JWT, supaya bisa dicabut per baris.

Password di-hash dengan PBKDF2-SHA256, 100000 iterasi. 100000 adalah batas atas workerd, bukan pilihan rasa. Di atas itu workerd melempar `NotSupportedError` dan setiap pendaftaran jadi 500.

Email dinormalisasi dengan `trim().toLowerCase()`.

### 4.3 Portal pengguna

| Route | Isi |
| --- | --- |
| `/user/dashboard` | Ringkasan: total CV, jumlah draft, jumlah selesai, CV terbaru |
| `/user/profile` | Nama, telepon, avatar (upload ke R2) |
| `/user/resume-builder` | Daftar CV dan tombol buat CV baru |

### 4.4 Editor CV

Route `/user/[id]/edit`. Editor berbasis skema: setiap section didefinisikan sebagai data di `packages/shared/src/section-schemas.ts`, lalu dirender satu komponen generik. Menambah section baru berarti menambah entri di `SECTION_SCHEMAS`, bukan menulis komponen.

Tujuh section: Personal Information (pinned), Education, Experience, Skills, Projects, Achievements, Certifications.

Per section: tambah entry, duplikat, hapus, sembunyikan, urutkan ulang (drag), ganti judul. Personal Information tidak bisa disembunyikan atau digeser karena selalu paling atas.

Per entry: isi field sesuai skema, tambah/hapus bullet, "Improve with AI" per bullet.

Dua bentuk tanggal: `date-range` dengan toggle "Present" untuk yang berlangsung, `date-single` untuk yang terjadi sekali (sertifikat, prestasi).

Preview A4 di sebelah kanan, zoom in/out, dan cetak lewat `window.print()`.

Preview menampilkan batas halaman sebagai sheet A4 yang terpisah, dengan garis putus-putus di setiap halaman setelah yang pertama dan nomor halaman. Pratinjau dan hasil cetak memakai satu pembagian halaman yang sama, jadi yang tampil di layar sama dengan yang keluar di PDF.

### 4.5 Template

Dua template tersedia: `blank` dan `classic`. Keduanya punya renderer sendiri, bukan satu layout dengan beberapa variasi.

`blank` adalah layout default: nama rata kiri, judul section bergaris bawah, bullet disc.

`classic` adalah layout formal yang mengutamakan cetak: nama rata tengah uppercase dengan tracking lebar, garis rangkap di bawah nama, judul section diapit dua garis, bullet en-dash, skill ditulis sebagai kalimat bukan grid, foto di atas nama dalam grayscale.

`modern` dan `minimal` masih terdaftar di `RESUME_TEMPLATES` dengan `available: false` dan tampil "Coming soon", supaya tidak ada janji yang belum ditepati.

Pemilihan template disimpan di `resume.document.templateId`. Renderer dipilih dari satu tempat (`SheetByTemplate`), bukan di tiap cabang preview dan print, supaya dua salinan tidak bisa memilih layout berbeda.

### 4.6 Area admin

| Route | Isi |
| --- | --- |
| `/admin` | Login admin |
| `/admin/dashboard` | Statistik: jumlah user, CV, sesi aktif |
| `/admin/users` | Tabel user: ubah nama, ubah role, hapus |
| `/admin/resumes` | Tabel semua CV: buka, edit, hapus |
| `/admin/resumes/[id]/edit` | Editor CV milik user lain |
| `/admin/profile` | Profil admin sendiri |

Admin tidak bisa menurunkan role dirinya sendiri. Dengan dua admin, yang terakhir akan mengunci semua orang dari area admin, dan perbaikannya butuh akses database langsung.

### 4.7 Backend

Hono di Cloudflare Workers, D1 untuk database, R2 untuk file.

Semua endpoint di-mount di bawah `/api`:

```
GET    /api/health
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
PATCH  /api/auth/me
GET    /api/resumes
POST   /api/resumes
GET    /api/resumes/:id
PATCH  /api/resumes/:id
DELETE /api/resumes/:id
GET    /api/admin/overview
GET    /api/admin/users
GET    /api/admin/resumes
PATCH  /api/admin/users/:id
DELETE /api/admin/users/:id
PATCH  /api/admin/resumes/:id
DELETE /api/admin/resumes/:id
POST   /api/storage/upload
GET    /api/storage/*
```

Dua keputusan yang perlu dijaga.

**Endpoint admin dipisah dari endpoint pemilik.** `/api/resumes/:id` menjawab 404 untuk siapa pun selain pemilik. Itu benar untuk user, tapi salah untuk admin yang memang harus melihat CV orang lain. Jadi ada handler terpisah di `/api/admin/resumes/:id` tanpa predicate pemilik sama sekali.

**`PATCH /api/auth/me` tidak punya id di path.** Baris yang diedit selalu baris milik pemanggil, jadi client tidak punya cara menyasar profil orang lain.

### 4.8 Penyimpanan file

Upload avatar ke R2. Batas 5MB, tipe yang diterima png, jpeg, jpg, webp, gif. Key: `uploads/<userId>/<timestamp>_<12 byte acak>.<ext>`.

`GET /api/storage/*` sengaja publik. `<img src>` tidak mengirim header Authorization, jadi membaginya di balik `requireAuth` membuat setiap avatar tampil sebagai gambar rusak. Key tidak bisa ditebak, jadi baca publik aman di sini.

### 4.9 Dwibahasa

Inggris dan Indonesia. Kamus ada di `packages/shared/src/i18n.ts` dengan kunci bertitik. `en` adalah sumber kebenaran, dan kamus `id` diketik terhadapnya, jadi menambah kunci tanpa padanan Indonesia adalah compile error, bukan string Inggris yang bocor diam-diam.

### 4.10 Tema

Light dan dark. Kelas `.dark` dipasang oleh skrip inline di root layout sebelum paint pertama, supaya tidak ada kedipan tema.

---

## 5. Cakupan fase 2 (belum mulai)

Bagian ini belum ada kodenya. Ditulis supaya tidak ada yang mengira sudah ada.

### 5.1 Template CV yang sudah ditulis

`modern` dan `minimal` sudah ada di `RESUME_TEMPLATES` dengan `available: false`. Yang belum ada adalah renderer-nya. `blank` dan `classic` sudah punya renderer masing-masing.

### 5.2 Mesin AI yang sebenarnya

`improveBullet(text, locale)` di `apps/frontend/src/lib/ai-improve.ts` sekarang hanya merapikan kapitalisasi, spasi, dan titik akhir, dengan jeda 600ms supaya status loading terlihat. Fungsi ini sudah punya kontrak yang benar: async, punya loading state, mengembalikan `null` pada kegagalan dan membiarkan teks user tetap.

Yang belum ada: panggilan ke model. Kalau nanti dipasang, tiga hal ini wajib dijaga:

- signature tetap `(text, locale) => Promise<string | null>`
- `locale` harus diteruskan, karena CV bahasa Indonesia harus diperbaiki dalam bahasa Indonesia
- kegagalan tidak boleh menimpa teks user

Aturan produknya jelas: AI memperbaiki kalimat, tidak mengarang prestasi. Tidak boleh menambah angka atau klaim yang tidak ada di teks asli.

### 5.3 Ekspor PDF

Tombol download sudah ada di UI tapi hanya membuka dialog cetak. Ekspor PDF server-side dengan font yang tertanam belum ada.

### 5.4 Vault profil

Tiap CV punya salinan data pribadi. Kalau ada 5 CV, ada 5 salinan yang bisa jadi tidak sinkron. Vault profil yang jadi sumber tunggal belum ada. Editor sekarang menyalin `Resume.personal` per CV.

### 5.5 Backup dan ekspor data

Tidak ada cara mengambil seluruh datamu sebagai JSON atau ZIP.

### 5.6 Rate limiting dan hardening lanjutan

Yang sudah ada: CORS wildcard, opaque session token, constant-time password compare, timing-equalized login, validasi tipe dan ukuran upload.

Yang belum: rate limiting per endpoint, account lockout setelah percobaan gagal berulang, Content-Security-Policy, notifikasi email, verifikasi email.

### 5.7 Halaman navbar yang belum ada

Navbar pill menunjuk ke anchor yang belum ada isinya: `#home`, `#features`, `#pricing`, `#about`, `#faq`. Halaman-halaman itu belum dibuat.

---

## 6. Aturan bisnis yang harus dijaga

### 6.1 Password

PBKDF2-SHA256, 100000 iterasi. Dua tempat yang harus selalu sama: `ITERATIONS` di `apps/backend/src/lib/password.ts` dan `DUMMY_HASH` di `apps/backend/src/routes/auth.ts`. Naikkan satu, jadi 500 seluruh pendaftaran.

### 6.2 Email tidak bisa diubah

`email` adalah identitas login dan kunci yang dirujuk semua tabel lain. Mengubahnya adalah migrasi akun, bukan edit profil. Endpoint self-service maupun endpoint admin tidak menyentuhnya.

### 6.3 Password tidak bisa ditulis admin

`password_hash` tidak writable di endpoint admin. Jadi admin yang session-nya bocor tidak bisa mengambil alih akun orang lain.

### 6.4 Admin tidak bisa demote diri sendiri

Sudah dijelaskan di 4.6.

### 6.5 Scope data per pemilik

Semua query resume milik user selalu menyertakan `WHERE user_id = ?`. Ini yang mencegah satu akun membaca atau menghapus CV orang lain dengan menebak id.

### 6.6 Section Personal Information tidak bisa disembunyikan

Selalu visible dan selalu paling atas.

### 6.7 Default tiga bullet

Entry baru mendapat tiga bullet kosong. Ini seed, bukan batas. User bebas menambah lebih dari tiga.

### 6.8 Migrasi dokumen

`migrateResume()` di `packages/shared/src/migrate.ts` menambahkan section yang hilang, dan section baru di-append di akhir. Men prepend akan mengacak urutan yang sudah dirapikan user.

Fungsi ini dipanggil di dua sisi: saat baca dari storage (mock), dan di backend saat baca maupun tulis dokumen. Dua kali karena dokumen masuk dan dokumen tersimpan sama-sama bisa kedaluwarsa.

---

## 7. Arsitektur

### 7.1 Bentuk repo

Monorepo npm workspaces.

```
packages/shared/    @helpmycv/shared — tipe, default, i18n, schema section
apps/backend/       @helpmycv/backend — Hono Worker
apps/frontend/      @helpmycv/frontend — Next.js 15 + OpenNext
```

### 7.2 Shared diimpor sebagai source, bukan build

`packages/shared/package.json` menunjuk ke `src/index.ts`. Frontend punya `transpilePackages: ["@helpmycv/shared"]`. Tidak ada langkah build, jadi editor dan typecheck selalu sinkron dengan source.

Konsekuensinya: kalau shared berubah, `npm run typecheck` harus tetap hijau. Kalau tidak, itu bug, bukan peringatan.

### 7.3 Routing API

Semua panggilan frontend adalah path relatif `/api/*`. Tidak pernah URL absolut ke `workers.dev`.

Alasannya: Worker tidak bisa `fetch()` Worker lain di `workers.dev`. Frontend yang ter-deploy menjangkau backend lewat service binding same-account, bukan lewat jaringan publik.

`API_BASE` di `api-client.ts` selalu kosong, dan itu disengaja. Environment variable yang sama hanya mengonfigurasi rewrite server-side di `next.config.ts`, tidak pernah jadi base fetch di browser.

### 7.4 Lapisan mock yang masih hidup

`API_ENABLED` = `process.env.NEXT_PUBLIC_API_BASE_URL !== undefined`. Kalau variable tidak di-set, auth dan resume store memakai localStorage di `helpmycv:*`.

Production selalu punya variable itu, jadi production selalu memakai backend. Mock layer tidak mati, hanya tidak aktif, dan semua flow tetap bisa diklik tanpa server.

Akun mock didefinisikan di `apps/frontend/src/lib/auth-store.ts`.

### 7.5 Model keamanan

- Sesi: token acak 32 byte hex, TTL 30 hari, tabel `sessions`
- Password: PBKDF2-SHA256, 100000 iterasi, compare constant-time
- Login dengan email yang tidak ada tetap di-hash terhadap dummy hash supaya waktu prosesnya sama
- ID user dan session dibuat dari `crypto.getRandomValues()`
- Upload: validasi tipe dan ukuran, key tidak bisa ditebak
- Admin: `requireAdmin` di seluruh route group

---

## 8. Deployment

### 8.1 Layout

| Aspek | Nilai |
| --- | --- |
| Frontend Worker | `helpmycv-frontend` |
| Frontend URL | `https://helpmycv-frontend.keianggoro12.workers.dev` |
| Backend Worker | `helpmycv-backend-production` (env `production`) |
| Backend URL | `https://helpmycv-backend-production.keianggoro12.workers.dev` |
| Database | D1 `helpmycv`, id `531e5932-7518-4e2c-83bf-2aa86822be85` |
| Bucket | R2 `helpmycv` |
| Account | `keianggoro12` |

### 8.2 CI

Dua workflow terpisah, satu per app, masing-masing terpicu oleh path filter.

`.github/workflows/deploy-frontend.yml`:
- trigger: push ke `main` yang menyentuh `apps/frontend/**`, `packages/shared/**`, atau workflow-nya sendiri
- Node 22, `npm ci`, build dengan `NEXT_PUBLIC_API_BASE_URL` yang di-set di dalam workflow
- `npx wrangler deploy` di `apps/frontend`

`.github/workflows/deploy-backend.yml`:
- trigger: sama, tapi untuk `apps/backend/**`
- `npx wrangler deploy --env production` di `apps/backend`

Keduanya butuh `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID` dari secrets.

### 8.3 Kenapa ada service binding

Rewrite `/api/*` di `next.config.ts` menunjuk ke host `workers.dev`, yang tidak bisa di-`fetch` dari Worker. Service binding same-account menjangkau backend tanpa keluar dari account.

`overrides/proxy-external-request.ts` yang mengimplementasikan ini juga stripping header `Host`, karena Cloudflare me-routing berdasarkan `Host` dan header yang tidak cocok akan 404 sebelum request sampai ke backend.

### 8.4 Kenapa production build menolak env kosong

`next.config.ts` melempar error kalau `NEXT_PUBLIC_API_BASE_URL` kosong saat build production. Fallback localhost yang aman untuk `next dev` justru berbahaya di deploy: string kosong itu falsy, jadi `"" || "http://localhost:8788"` menghasilkan localhost, Worker mencoba fetch loopback yang tidak bisa diawati, dan Cloudflare membalas error 1003 untuk setiap `/api/*`. Build yang terlihat benar, gagal total di production.

### 8.5 Kenapa dev dan build butuh distDir terpisah

`next dev` dan `next build` sama-sama menulis `.next`. Menjalankan build sementara dev server hidup menghapus vendor chunk yang sedang disajikan, dan semua route jadi 500. Dev memakai `NEXT_DIST_DIR=.next-dev`.

### 8.6 Migrasi database

```bash
npm run db:migrate --workspace=@helpmycv/backend        # remote
npm run db:migrate:local --workspace=@helpmycv/backend   # local
```

Migrasi backend tidak otomatis di CI. Setelah deploy backend, migrasi harus dijalankan manual.

---

## 9. Testing

Belum ada test suite. Verifikasi saat ini:

```bash
npm run lint
npm run typecheck
npm run build
```

`npm run build` gagal kalau `NEXT_PUBLIC_API_BASE_URL` tidak di-set. Untuk build lokal, set ke `http://localhost:8788`.

Ada satu script verifikasi, `apps/frontend/scripts/verify-reorder.mjs`, yang dipakai manual.

---

## 10. Risiko dan jebakan yang sudah diketahui

- **PBKDF2 iteration ceiling.** 100000 adalah batas workerd. Count yang lebih tinggi membuat seluruh pendaftaran 500.
- **DUMMY_HASH harus sinkron dengan ITERATIONS.** Hashing dengan count yang salah merusak timing-equalization, dan register kehilangan equality check-nya.
- **Migrasi 0002 masih menulis hash dengan 210000 iterasi.** Hash lama itu salah, diperbaiki di 0007. Dua file migrasi itu tidak boleh dihapus tanpa izin.
- **Env variable untuk production build wajib.** Sudah dijelaskan di 8.4.
- **Endpoint admin terpisah.** Dicoba menyatukan dengan flag `isAdmin` akan menyebarkan pengecualian ke query yang paling butuh seragam.
- **Shared tanpa build step.** Tipe bisa stale kalau ada yang hanya run typecheck di frontend.
- **Mock layer masih aktif di development.** convincingly mengikuti backend dengan frontend saja, tanpa backend yang hidup.

---

## 11. Yang belum ada

- Template `modern` dan `minimal` belum punya renderer
- Mesin AI belum ada, yang ada baru perapian kalimat
- Ekspor PDF beneran belum ada, cuma dialog cetak
- Navbar pill masih menunjuk ke anchor kosong
- Tidak ada test suite
- Tidak ada rate limiting
- Tidak ada verifikasi email
- Tidak ada vault profil yang jadi sumber tunggal
- Tidak ada backup atau ekspor data

---

## 12. Riwayat

41 commit. Fase 1 dibangun dari nol: setup deploy, akun, tipe shared, editor berbasis skema, admin portal, perbaikan avatar, dan tampilan landing.
