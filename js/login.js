import { auth, resolveLogin, roleOfUser, ROLE_PAGE } from "./common.js";

// Pesan error yang spesifik agar mudah dicari penyebabnya
function errorText(err) {
  switch (err.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/invalid-login-credentials":
      return "Password salah. Cek lagi huruf besar/kecil.";
    case "auth/user-not-found":
      return "Akun belum dibuat di Firebase Authentication.";
    case "auth/too-many-requests":
      return "Terlalu banyak percobaan. Tunggu beberapa menit.";
    case "auth/unauthorized-domain":
      return "Domain website ini belum diizinkan. Tambahkan di Firebase → Authentication → Settings → Authorized domains.";
    case "auth/network-request-failed":
      return "Tidak ada koneksi internet.";
    case "auth/operation-not-allowed":
      return "Email/Password belum diaktifkan di Firebase Authentication.";
    default:
      return "Gagal login (" + (err.code || err.message) + ").";
  }
}
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const form = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");
const loginBtn = document.getElementById("loginBtn");

// Jika sudah login, langsung arahkan ke halaman sesuai role
onAuthStateChanged(auth, (user) => {
  if (!user) return;
  const role = roleOfUser(user);
  if (role) location.replace(ROLE_PAGE[role]);
  else signOut(auth);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMsg.textContent = "";

  const password = form.password.value;
  const login = resolveLogin(form.username.value);

  if (!login) {
    errorMsg.textContent = "Username tidak dikenal. Gunakan 'kasirklz' atau 'adminklz'.";
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Memeriksa...";

  try {
    await signInWithEmailAndPassword(auth, login.email, password);
    // Redirect ditangani oleh onAuthStateChanged di atas
  } catch (err) {
    console.error("Login error:", err.code, err.message);
    errorMsg.textContent = errorText(err);
    loginBtn.disabled = false;
    loginBtn.textContent = "Masuk";
  }
});
