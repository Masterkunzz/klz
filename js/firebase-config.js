// ============================================================
// KONFIGURASI FIREBASE
// Ganti nilai di bawah dengan config dari Firebase Console:
// Project settings > General > Your apps > Web app > firebaseConfig
// ============================================================
export const firebaseConfig = {
  apiKey: "GANTI_API_KEY",
  authDomain: "GANTI_PROJECT_ID.firebaseapp.com",
  projectId: "GANTI_PROJECT_ID",
  storageBucket: "GANTI_PROJECT_ID.appspot.com",
  messagingSenderId: "GANTI_SENDER_ID",
  appId: "GANTI_APP_ID"
};

// Username login (HURUF KECIL). Harus sama dengan email di Firebase Auth
// dan dengan rule di firestore.rules.
export const ADMIN_USERNAME = "adminklz";
export const KASIR_USERNAME = "kasirklz";

// Domain "palsu" untuk mengubah username menjadi email (tidak perlu dibuat)
export const EMAIL_DOMAIN = "klz.app";
