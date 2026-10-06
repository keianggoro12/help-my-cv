# Document Requirements Specification (DRS)
## Fitur: Auto CV / Auto Resume Builder (AI-Powered)

---

### 1. Deskripsi Fitur
Fitur **Auto CV / Auto Resume Builder** memungkinkan pengguna untuk membuat draf resume secara otomatis hanya dengan memasukkan deskripsi bebas mengenai informasi diri, riwayat pekerjaan, pendidikan, serta pilihan template. AI akan memilah (*parsing*), merapikan, dan menyempurnakan tata bahasa pengguna tanpa mengubah makna asli, lalu memasukkannya langsung ke dalam formulir resume.

---

### 2. Alur Pengguna (User Flow)

#### 2.1. Navigasi & Halaman Utama Fitur
1. Pengguna melakukan *login* ke aplikasi.
2. Di atas menu **CV**, terdapat menu baru bernama **Auto CV** (atau **Auto Resume**).
3. Pengguna mengklik menu **Auto CV** dan diarahakan (*redirect*) ke URL:
   `/user/auto-resume`

#### 2.2. Form Input & Proses AI
1. Halaman `/user/auto-resume` menyediakan komponen input berikut:
   * **Resume Name**: Field teks untuk nama/judul resume (misal: "Resume Software Engineer 2026").
   * **Describe Your Resume / CV**: Field teks area (*textarea*) tempat pengguna mengisi riwayat pekerjaan, pendidikan, keahlian, dan detail lainnya dalam satu kolom bebas.
   * **Template Selection**: Pilihan *dropdown* atau *card* untuk memilih template CV.
   * **Button Process**: Tombol untuk memulai pembuatan resume.
2. Saat tombol **Process** diklik:
   * Tampilan layar menjadi *greyed out* (overlay transparan) dan memunculkan indikator *loading*.
   * Sistem mengirimkan input pengguna ke *backend* untuk diproses oleh *engine* AI.

#### 2.3. Output & Editing Resume
1. *Engine* AI mengekstraksi data, merapikan struktur kalimat, serta memetakan informasi ke field yang sesuai secara otomatis.
2. Setelah proses AI selesai dan record resume baru berhasil dibuat di database, sistem mengarahkan pengguna ke halaman penyuntingan:
   `https://helpmycv-frontend.keianggoro12.workers.dev/user/:id/edit`
   *(Catatan: `:id` diganti dengan ID dari resume yang baru saja dibuat)*.
3. Seluruh field di halaman penyuntingan sudah terisi secara otomatis (*pre-filled*) dengan data yang telah diproses oleh AI.

---

### 3. Sisi Administrator (Admin Side)

#### 3.1. Pengaturan AI (Config Menu)
1. Terdapat menu baru di halaman Admin bernama **Config**.
2. Di dalam menu **Config**, terdapat seksi konfigurasi engine AI:
   * **Model Selection**: Choice/Dropdown untuk memilih model AI yang digunakan (misal: Gemini, OpenAI, Claude, dll.).
   * **API Key Input**: Field teks sensitif/tersembunyi untuk menyimpan API Key.
   * **Button Save**: Tombol untuk menyimpan pengaturan konfigurasi.
   * **Button Check**: Tombol untuk melakukan uji konektivitas dan validasi API Key.

#### 3.2. Monitoring & Logging
1. Di bawah seksi konfigurasi, terdapat panel **Log**:
   * Menampilkan riwayat status koneksi API.
   * Menampilkan pesan error jika terjadi batas kuota terlampaui (*rate limit/reach limit*), API Key tidak valid, atau gangguan jaringan.

---

### 4. Instruksi Tampilan & Desain UI/UX
* **Konsistensi UI**: Wajib menggunakan *styling* CSS, komponen UI, tata letak (*layout*), dan panduan warna yang sudah ada pada proyek (*existing UI design system*).
* **State Loading**: Gunakan komponen modal overlay atau backdrop *greyed out* bawaan yang ada pada sistem saat proses pembuatan resume berjalan.