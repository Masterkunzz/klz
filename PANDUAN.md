# Panduan Setup Aplikasi Kasir Kedai Lumpur Zein

Struktur folder:

```
klz-kasir/
├── index.html        → halaman login (sebelum login)
├── admin.html        → halaman admin (produk + analitik)
├── kasir.html        → halaman kasir (new order)
├── css/style.css
├── js/
│   ├── firebase-config.js   ← ISI CONFIG FIREBASE DI SINI
│   ├── common.js
│   ├── login.js
│   ├── admin.js
│   └── kasir.js
├── assets/klz.jpg
├── firestore.rules          ← dipakai di Firebase Console
├── netlify.toml
└── PANDUAN.md
```

---

## Bagian 1 — Membuat Project Firebase

1. Buka https://console.firebase.google.com dan login dengan akun Google.
2. Klik **Add project** (Tambah project), beri nama `klz-kasir`, lalu lanjutkan. Google Analytics boleh dimatikan.
3. Setelah project jadi, masuk ke menu **Build → Firestore Database**.
4. Klik **Create database**, pilih **Start in production mode**, lalu pilih lokasi **asia-southeast2 (Jakarta)**. Klik **Enable**.

### 1a. Pasang aturan keamanan Firestore
1. Di Firestore, buka tab **Rules**.
2. Hapus isi yang ada, lalu copy-paste seluruh isi file `firestore.rules`.
3. Klik **Publish**.

> Jika kamu mengganti username admin, ubah juga email `adminklz@klz.app` di file ini.

### 1b. Mengaktifkan login email/password
1. Buka **Build → Authentication**, klik **Get started**.
2. Tab **Sign-in method** → pilih **Email/Password** → aktifkan **Enable** → **Save**.

### 1c. Membuat akun admin dan kasir
Aplikasi memakai username yang dikonversi otomatis menjadi email (`username@klz.app`). Akun ini dibuat manual di Firebase:

1. Buka tab **Users** → klik **Add user**.
2. Buat akun **admin**:
   - Email: `adminklz@klz.app`
   - Password: **buat password admin pilihanmu sendiri** (minimal 6 karakter, jangan dibagikan)
3. Klik **Add user** lagi untuk akun **kasir**:
   - Email: `kasirklz@klz.app`
   - Password: `klzkasir`

Sekarang login di aplikasi:
- Admin → username `adminklz` + password pilihanmu
- Kasir → username `kasirklz` + password `klzkasir`

> **Penting:** di kolom Username cukup ketik `kasirklz`, **bukan** `kasirklz@klz.app`. Email hanya dipakai di Firebase Console. (Versi terbaru aplikasi sudah menerima keduanya, tapi tetap disarankan memakai username.)

> Catatan: di Firebase, Email/Password memerlukan **minimal 6 karakter**. Password `klzkasir` sudah memenuhi syarat.

---

## Bagian 2 — Menghubungkan Aplikasi ke Firebase

1. Di Firebase Console, klik ikon **gerigi ⚙ → Project settings**.
2. Scroll ke bawah ke bagian **Your apps** → klik ikon **Web (`</>`)**.
3. Beri nama app (misal `klz-web`), **jangan** centang Firebase Hosting, lalu klik **Register app**.
4. Akan muncul kode `firebaseConfig`. Copy nilainya.
5. Buka file `js/firebase-config.js` dan ganti bagian `GANTI_...` dengan nilai dari langkah 4:

```js
export const firebaseConfig = {
  apiKey: "AIza....",
  authDomain: "klz-kasir.firebaseapp.com",
  projectId: "klz-kasir",
  storageBucket: "klz-kasir.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
```

> `apiKey` memang boleh terlihat di browser. Keamanan data dijaga oleh `firestore.rules` dan daftar akun di Authentication, bukan oleh kerahasiaan apiKey.

---

## Bagian 3 — Deploy ke Netlify

### Cara A — Drag & drop (paling mudah)
1. Buka https://app.netlify.com dan login (boleh pakai akun Google).
2. Klik **Add new site → Deploy manually**.
3. Drag folder **`klz-kasir`** (folder yang berisi `index.html`) ke area kotak upload.
4. Tunggu hingga status **Published**. Netlify akan memberi link seperti `https://nama-acak.netlify.app`.
5. (Opsional) Klik **Site configuration → Change site name** untuk mengganti nama, misalnya `klz-kasir.netlify.app`.

### Cara B — Lewat GitHub (untuk update lebih mudah)
1. Upload folder `klz-kasir` ke repository GitHub.
2. Di Netlify: **Add new site → Import an existing project → GitHub**, pilih repository tersebut.
3. Build command dikosongkan, **Publish directory** diisi `.` (titik). Klik **Deploy**.
4. Setiap kali kamu push perubahan ke GitHub, Netlify otomatis deploy ulang.

### ⚠️ Langkah WAJIB setelah deploy: izinkan domain Netlify di Firebase
Tanpa langkah ini, login akan gagal di website (error `auth/unauthorized-domain`).

1. Di Firebase Console → **Build → Authentication → Settings** → tab **Authorized domains**.
2. Klik **Add domain**, isi dengan domain Netlify kamu, misalnya `klz-kasir.netlify.app` (tanpa `https://`).
3. Simpan.

**Jika memakai domain sendiri** (misal `klz.editinbang.my.id`), domain itu WAJIB juga ditambahkan di Authorized domains. Tanpa ini, login gagal dengan pesan "Domain website ini belum diizinkan". Domain `localhost` biasanya sudah ada otomatis untuk tes di komputer sendiri.

---

## Bagian 4 — Cara Pakai

### Halaman login
- Halaman pertama yang dibuka. Berisi logo, judul **APLIKASI KASIR KEDAI LUMPUR ZEIN**, dan teks *develop by Ahmad Bafagih* (klik untuk membuka Instagram).
- Masukkan username & password. Sistem otomatis mengarahkan ke halaman admin atau kasir.

### Halaman admin
- **Tab Produk**: isi nama produk, seller, dan harga → **Simpan Produk**. Gunakan tombol **Edit** atau **Hapus** di tabel untuk mengubah atau menghapus produk.
- **Tab Analitik Penjualan**:
  - Kartu ringkasan: omzet hari ini, minggu ini, dan bulan ini.
  - Pilih **Harian / Mingguan / Bulanan** untuk melihat grafik, rincian transaksi, total item terjual, pembagian Cash/QRIS, dan produk terlaris.

### Halaman kasir
1. Tekan **+ New Order**.
2. Produk tampil dalam kotak-kotak. Ketik di kolom pencarian untuk mencari nama produk atau seller.
3. Tekan kotak produk untuk menambahkannya ke pesanan. Gunakan **+ / −** untuk mengubah jumlah, **✕** untuk menghapus.
4. Isi **Nominal Bayar** (atau tekan pecahan 10rb / 20rb / 50rb / 100rb / Uang pas). **Kembalian** otomatis terhitung.
5. Pilih metode **Cash** atau **QRIS**. Jika QRIS, nominal otomatis terisi sesuai total.
6. Tekan **Simpan Pesanan**. Muncul popup centang beranimasi dengan nomor pesanan dan kembalian.
7. Tekan **Tutup** untuk kembali ke halaman utama.

---

## Bagian 5 — Mengganti Username / Password

- **Password**: Firebase Console → Authentication → Users → klik ⋮ pada akun → **Reset password** atau hapus lalu buat ulang.
- **Username admin**: 
  1. Ubah `ADMIN_USERNAME` di `js/firebase-config.js`.
  2. Buat user baru di Authentication dengan email `usernamebaru@klz.app`.
  3. Ubah email admin di `firestore.rules` (fungsi `isAdmin` dan `isStaff`), lalu Publish ulang.
  4. Deploy ulang ke Netlify.

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| "Username tidak dikenal" | Username yang diketik salah. Gunakan `kasirklz` atau `adminklz`. |
| "Password salah" | Password tidak cocok dengan yang di Firebase. Reset lewat Authentication → Users → ⋮ → Reset password. |
| "Akun belum dibuat" | User belum ditambahkan di Authentication dengan email `kasirklz@klz.app`. |
| Login gagal terus | Buka F12 → Console, lihat kode error (`auth/...`) yang muncul, lalu cocokkan dengan tabel ini. |
| `auth/unauthorized-domain` | Tambahkan domain Netlify ke Authorized domains (Bagian 3). |
| "Missing or insufficient permissions" | Rules Firestore belum dipublish, atau email di rules tidak cocok dengan akun. |
| Produk tidak muncul di kasir | Tambahkan produk dulu lewat halaman admin. |
| Grafik tidak tampil | Pastikan koneksi internet aktif (Chart.js dimuat dari CDN). |

---

## Catatan Tablet
- Di tablet landscape, daftar produk di kiri dan keranjang di kanan (layar ≥ 900px).
- Di tablet portrait atau HP, layout menyesuaikan menjadi satu kolom.
- Semua tombol dibuat cukup besar untuk disentuh dengan jari.

---

## Pembaruan Fitur (versi terbaru)

### Login
- Login kembali memakai **username saja**: `adminklz` atau `kasirklz`. Tidak perlu mengetik `@klz.app`.

### Produk (halaman admin → tab Produk)
- Tekan **+ Tambah Produk** untuk membuka popup. Isi:
  - **Nama produk**
  - **Seller** (wajib diisi). Ketik nama seller baru atau pilih dari daftar seller yang sudah ada.
  - **Harga** (bebas, termasuk angka 0, 5000, 7500, dst.)
  - **Kategori**: Jajan, Minuman, Nasi, Lauk, atau Lainnya
- Produk dikelompokkan per seller di tabel. Filter kategori dan pencarian tersedia di atas.
- Tombol **Edit** membuka popup yang sama dengan data terisi.

> Penyebab harga harus berakhiran 1 pada versi sebelumnya: input harga memakai `step="100"`, sehingga browser hanya menerima 1, 101, 201, dst. Sudah diperbaiki menjadi `step="1"`.

### Kasir
- Di halaman **New Order**, tersedia filter kategori (Semua, Jajan, Minuman, Nasi, Lauk, Lainnya) di atas daftar produk. Filter bisa dikombinasikan dengan pencarian nama.
- Setelah pesanan disimpan, terdengar **suara kasir (cash)**.
  - Untuk memakai suara sendiri, letakkan file MP3 di `assets/cash.mp3`. Jika file tidak ada, aplikasi memakai suara bawaan.
  - Browser memblokir suara sampai pengguna pernah berinteraksi dengan halaman. Setelah satu kali klik di halaman, suara akan berbunyi normal.

### Riwayat Penjualan & Ralat (halaman admin → tab Riwayat)
- Semua transaksi tampil dalam tabel. Filter berdasarkan rentang tanggal dan metode (Cash/QRIS).
- Tombol **Edit** untuk meralat pesanan:
  - Ubah jumlah item (+ / −) atau hapus item
  - Ubah metode pembayaran dan nominal bayar
  - Total dan kembalian dihitung ulang otomatis
- Tombol **Hapus** untuk menghapus transaksi yang salah input. Tindakan ini tidak bisa dibatalkan.
- Setiap ralat tersimpan dengan field `editedAt` di Firestore sebagai jejak perubahan.

### Update rules
Tidak ada perubahan pada `firestore.rules`. Rules sebelumnya sudah mengizinkan admin untuk mengubah dan menghapus pesanan. Namun, jika Anda sudah pernah memasang rules, pastikan rules tersebut sudah dipublish ulang agar nilai terbaru berlaku.

---

## Pembaruan: Seller, Kategori, dan Ralat Kasir

### WAJIB: publish ulang Firestore Rules
Aturan keamanan berubah (ada koleksi `sellers` dan `categories`, dan kasir boleh mengedit pesanan).
Firebase Console → Firestore Database → **Rules** → hapus isi lama → paste isi `firestore.rules` → **Publish**.
Kalau lupa langkah ini, daftar seller dan kategori tidak akan muncul di kasir.

### Admin: tab "Seller & Kategori"
- **Seller**: tambah nama seller di sini dulu. Seller yang masih dipakai produk tidak bisa dihapus.
- **Kategori**: tambah atau hapus kategori. Kategori default: jajan, jajanan utama, minuman, nasi, lauk, lainnya.
- Saat pertama kali admin dibuka, seller dan kategori dari produk lama otomatis dimasukkan ke daftar.

### Admin: tambah produk
- Seller dan kategori dipilih dari dropdown, tidak lagi diketik bebas.
- Kalau daftar seller atau kategori masih kosong, aplikasi memberi peringatan.

### Kasir
- **Pilih seller** dengan menggeser deretan seller (drag dengan mouse atau swipe di layar sentuh).
- Setelah seller dipilih, **kategori yang tampil hanya milik seller itu**. Produk juga ikut terfilter.
- **Riwayat Transaksi** di halaman depan kasir menampilkan transaksi per tanggal. Pilih tanggal dengan kolom tanggal di atasnya.
- Tombol **Edit** pada transaksi membuka popup untuk meralat item, jumlah, metode, dan nominal bayar.
- Kasir **tidak bisa menghapus** transaksi. Hanya admin yang bisa menghapus.
