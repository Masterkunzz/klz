// ============================================================
// KONFIGURASI FIREBASE
// Ganti nilai di bawah dengan config dari Firebase Console:
// Project settings > General > Your apps > Web app > firebaseConfig
// ============================================================
export const firebaseConfig = {
  apiKey: "AIzaSyB172wDbBqeCRtpZw_TawJ92efHKmUI_8w",
  authDomain: "klz-kasir.firebaseapp.com",
  projectId: "klz-kasir",
  storageBucket: "klz-kasir.firebasestorage.app",
  messagingSenderId: "924187392377",
  appId: "1:924187392377:web:98f850816f2db12f1e17a8"
};

// Username login (HURUF KECIL). Harus sama dengan email di Firebase Auth
// dan dengan rule di firestore.rules.
export const ADMIN_USERNAME = "adminklz";
export const KASIR_USERNAME = "kasirklz";

// Domain "palsu" untuk mengubah username menjadi email (tidak perlu dibuat)
export const EMAIL_DOMAIN = "klz.app";
