# Help My CV

Aplikasi web untuk membuat dan menyimpan CV. Satu orang bisa punya banyak CV, satu untuk tiap lamaran, semuanya di satu akun.

Tagline: "We only help your CV, not your career."

Read [PRD.md](./PRD.md) untuk konteks produk lengkap.

---

## Stack

| Bagian | Teknologi |
| --- | --- |
| Monorepo | npm workspaces |
| Frontend | Next.js 15.5.27 (App Router), React 19, Tailwind v3 |
| Backend | Hono 4 di Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| File | Cloudflare R2 |
| Deploy | OpenNext, GitHub Actions |
| Auth | PBKDF2-SHA256 + token sesi opaque |

---

## Struktur

```
help-my-cv/
├── packages/
│   └── shared/              @helpmycv/shared
│       └── src/
│           ├── types.ts         tipe domain (Resume, UserProfile, SectionKey)
│           ├── defaults.ts      factory entry kosong, urutan section, template
│           ├── section-schemas.ts  skema field per section
│           ├── i18n.ts          kamus en/id
│           ├── api-types.ts     bentuk respons API
│           ├── migrate.ts       migrateResume()
│           └── index.ts
├── apps/
│   ├── backend/             @helpmycv/backend
│   │   ├── migrations/        8 file SQL, apply manual
│   │   └── src/
│   │       ├── index.ts       entry Hono, mount /api/*
│   │       ├── routes/
│   │       │   ├── index.ts     agregator route group
│   │       │   ├── auth.ts      register, login, logout, profile
│   │       │   ├── resumes.ts   CRUD CV + varian admin
│   │       │   ├── admin.ts     statistik, user, edit milik orang lain
│   │       │   └── storage.ts   upload dan baca R2
│   │       ├── middleware/
│   │       │   └── auth.ts      attachUser, requireAuth, requireAdmin
│   │       └── lib/
│   │           ├── password.ts   PBKDF2-SHA256
│   │           ├── session.ts   token sesi opaque
│   │           └── helpers.ts    json(), CORS
│   └── frontend/            @helpmycv/frontend
│       ├── overrides/
│       │   └── proxy-external-request.ts   service binding + strip Host
│       └── src/
│           ├── app/            route App Router
│           ├── components/
│           │   ├── landing/    halaman pemasaran + aura gradient
│           │   ├── auth/       dialog login/register
│           │   ├── editor/     editor CV, paginate.ts, page-stack.tsx, preview A4, classic-sheet.tsx
│           │   ├── portal/     layout user dan admin
│           │   ├── profile/    halaman profil
│           │   ├── admin/      tabel dan halaman admin
│           │   ├── resume/     daftar CV, buat CV
│           │   ├── providers/  SessionProvider (session + locale)
│           │   └── ui/         primitif: button, dialog, toast, navbar
│           └── lib/
│               ├── api-client.ts   fetch relatif /api/*
│               ├── auth-store.ts   auth: mock atau API
│               ├── resume-store.ts  CV: mock atau API
│               ├── storage.ts       localStorage mock
│               └── ai-improve.ts    perapian bullet (mock)
└── .github/
    └── workflows/
        ├── deploy-frontend.yml
        └── deploy-backend.yml
```

---

## Menjalankan secara lokal

Prasyarat: Node 22, Akun Cloudflare (untuk login wrangler pertama kali).

```bash
npm install
```

### Backend

```bash
npm run dev:backend                                    # wrangler di :8788
npm run db:migrate:local --workspace=@helpmycv/backend  # buat schema
```

State lokal disimpan di `apps/backend/.wrangler/state`, jadi data lokal bertahan antar restart.

### Frontend

Tanpa `.env`, frontend jalan dengan mock auth dan localStorage. Semua flow bisa diklik tanpa backend hidup. Akun mock ada di `apps/frontend/src/lib/auth-store.ts`.

Dengan backend hidup:

```bash
cp apps/frontend/.env.example apps/frontend/.env.local
npm run dev                                             # Next di :3000
```

`.env.example` berisi `NEXT_PUBLIC_API_BASE_URL=http://localhost:8788`. Keberadaan variable inilah yang menyalakan API dan mematikan mock.

Jalankan frontend dengan `NEXT_DIST_DIR=.next-dev` (sudah baked ke script `dev`), bukan `.next`. Build dan dev server tidak bisa berbagi satu direktori output, dan kalau build berjalan sementara dev hidup, semua route jadi 500.

---

## Verifikasi

```bash
npm run lint
npm run typecheck
npm run build
```

`npm run build` production menolak jalan tanpa `NEXT_PUBLIC_API_BASE_URL`. Untuk build lokal:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8788 npm run build
```

---

## Deployment

Deploy otomatis lewat GitHub Actions, satu workflow per app dengan path filter.

Frontend deploy saat push menyentuh `apps/frontend/**` atau `packages/shared/**`. Backend deploy saat push menyentuh `apps/backend/**` atau `packages/shared/**`.

| | |
| --- | --- |
| Frontend | `https://helpmycv-frontend.keianggoro12.workers.dev` |
| Backend | `https://helpmycv-backend-production.keianggoro12.workers.dev` |
| D1 | `helpmycv` (`531e5932-7518-4e2c-83bf-2aa86822be85`) |
| R2 | `helpmycv` |

Migrasi database tidak otomatis di CI. Setelah deploy backend, jalankan manual:

```bash
npm run db:migrate --workspace=@helpmycv/backend
```

Deploy manual:

```bash
npm run build:opennext --workspace=@helpmycv/frontend   # butuh NEXT_PUBLIC_API_BASE_URL
cd apps/frontend && npx wrangler deploy
cd ../backend && npx wrangler deploy --env production
```

---

## Akun

Akun demo ada di repo dan password-nya sudah diketahui publik, jadi jangan dipakai di environment yang benar-benar dipakai user. Buat akun sendiri lewat halaman register, atau jalankan seed lokal.

Seed lokal ada di migrasi backend (`apps/backend/migrations/`), bukan di README. Akun yang hanya ada kalau migrasi 0002 dan 0007 sudah applied.

Kalau butuh reset, hapus baris user dari D1 lokal lalu jalankan ulang migrasinya. Rotasi password demo juga perlu mengubah hash di migrasi.

---

## Aturan yang mudah dilanggar

**PBKDF2 100000 iterasi.** 100000 adalah batas workerd, bukan pilihan. Di atas itu workerd melempar `NotSupportedError` dan setiap pendaftaran jadi 500. `ITERATIONS` di `apps/backend/src/lib/password.ts` dan `DUMMY_HASH` di `apps/backend/src/routes/auth.ts` harus selalu sama.

**Fetch harus relatif.** Semua panggilan API adalah `/api/*` relatif, tidak pernah URL absolut ke `workers.dev`. Worker tidak bisa `fetch()` Worker lain di `workers.dev`. `API_BASE` di `api-client.ts` sengaja dibiarkan kosong.

**Menambah section editor lewat skema.** Tambah entri di `SECTION_SCHEMAS` (`packages/shared/src/section-schemas.ts`), bukan membuat komponen baru. Section Personal Information punya bentuk sendiri dan tidak ada di skema itu.

**Shared tanpa build step.** `@helpmycv/shared` consumed source TypeScript mentah. Kalau shared berubah, jalankan typecheck di root, bukan hanya di frontend.

**Admin endpoint terpisah dari endpoint pemilik.** `/api/resumes/:id` menjawab 404 untuk bukan pemilik. `/api/admin/resumes/:id` tidak punya predicate pemilik. Jangan gabungkan dengan flag `isAdmin`.

**`email` dan `password_hash` tidak writable.** lewat endpoint mana pun yang sudah ada. Mengubah email adalah migrasi akun; mengganti hash berarti mengambil alih akun orang.

**Pagination dihitung satu kali, bukan dua.** Preview dan salinan cetak harus dirender dari satu `pages` yang sama. Kalau masing-masing mengukur sendiri, salinan cetak berada di portal `display:none` tempat setiap box tingginya nol, jadi seluruh CV akan dianggap muat di satu halaman. Pengukuran terjadi di `usePagination` (`page-stack.tsx`), dipanggil sekali, lalu kedua salinan render dari hasilnya.

**Margin vertikal hanya di `page-stack.tsx`.** `SECTION_GAP_PX` dan `HEADING_GAP_PX` dihitung saat pengukuran dan dipakai lagi saat render. Template yang memasang margin sendiri akan membuat keduanya tidak sinkron dan tiap halaman meleset beberapa milimeter dari kapasitas yang sudah dipesan.

**Template baru lewat tiga tempat.** Tambah id di `RESUME_TEMPLATES` (`packages/shared/src/defaults.ts`), tulis komponen presentasi (lihat `classic-sheet.tsx`), lalu daftarkan cabangnya di `renderHeading`/`renderBody` pada `SheetByTemplate`. Jangan buat renderer yang mengukur sendiri.

---

## Endpoint

Semua di-mount di bawah `/api`.

```
GET    /api/health

POST   /api/auth/register      publik
POST   /api/auth/login         publik
POST   /api/auth/logout        butuh sesi
GET    /api/auth/me            401 kalau tidak ada sesi
PATCH  /api/auth/me            butuh sesi, edit baris sendiri

GET    /api/resumes            butuh sesi, scope user_id
POST   /api/resumes            butuh sesi
GET    /api/resumes/:id        butuh sesi, scope user_id
PATCH  /api/resumes/:id        butuh sesi, scope user_id
DELETE /api/resumes/:id        butuh sesi, scope user_id

GET    /api/admin/overview     butuh admin
GET    /api/admin/users        butuh admin
GET    /api/admin/resumes      butuh admin
PATCH  /api/admin/users/:id    butuh admin
DELETE /api/admin/users/:id    butuh admin
PATCH  /api/admin/resumes/:id  butuh admin
DELETE /api/admin/resumes/:id  butuh admin

POST   /api/storage/upload     butuh sesi
GET    /api/storage/*           publik (kunci tidak bisa ditebak)
```

`attachUser` jalan di seluruh `/api/*` dan hanya resolve bearer token kalau ada, tidak menolak. Penolakan terjadi di `requireAuth`/`requireAdmin` per route, jadi `/auth/login` tidak terblokir.

---

## Model keamanan

- Sesi: token acak 32 byte hex, TTL 30 hari, tabel `sessions`, bisa dicabut per baris
- Password: PBKDF2-SHA256 100000 iterasi, salt hex di-decode ke raw bytes sebelum derivasi
- Login dengan email yang tidak ada tetap di-hash terhadap dummy hash, supaya waktu proses email salah dan password salah sama
- ID user dan session dari `crypto.getRandomValues()`
- Upload: maks 5MB, hanya png/jpeg/jpg/webp/gif
- `GET /api/storage/*` publik karena `<img src>` tidak mengirim header Authorization

---

## Data

```
users     id, email, name, password_hash, role, image_url, created_at
sessions  token, user_id, created_at, expires_at
resumes   id, user_id, title, document, created_at, updated_at
```

`resumes.document` adalah satu blob JSON berisi seluruh isi editor. Kolom `title`, `created_at`, `updated_at` adalah denormalisasi untuk tampilan daftar. `status` (draft/final) dibaca dari dalam blob, bukan kolom sendiri.

Hapus user akan menghapus CV dan sesinya lewat `ON DELETE CASCADE`.

---

## Yang belum ada

- Template `modern` dan `minimal` belum punya renderer
- Mesin AI belum ada, `improveBullet` sekarang hanya merapikan kalimat
- Ekspor PDF beneran belum ada, tombolnya masih membuka dialog cetak
- Navbar pill masih menunjuk ke anchor yang belum ada isinya
- Belum ada test suite
- `apps/frontend/src/app/pagetest-harness/` masih ada, itu harness verifikasi pagination dan harus dihapus sebelum commit
- `npm run lint` gagal karena `next lint` meminta setup interaktif, belum ada konfigurasi ESLint yang bisa dipakai non-interaktif
- Belum ada rate limiting, verifikasi email, backup data
