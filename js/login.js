import { auth, usernameToEmail, roleOfUsername, roleOfUser, ROLE_PAGE } from "./common.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const form = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");
const loginBtn = document.getElementById("loginBtn");

function errorText(err) {
  switch (err.code) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
      return "Username atau password salah.";
    case "auth/user-not-found":
      return "Akun belum dibuat di Firebase Authentication.";
    case "auth/too-many-requests":
      return "Terlalu banyak percobaan. Tunggu beberapa menit.";
    case "auth/unauthorized-domain":
      return "Domain website ini belum diizinkan di Firebase (Authorized domains).";
    case "auth/network-request-failed":
      return "Tidak ada koneksi internet.";
    default:
      return "Gagal login (" + (err.code || err.message) + ").";
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  const role = roleOfUser(user);
  if (role) location.replace(ROLE_PAGE[role]);
  else signOut(auth);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMsg.textContent = "";

  const username = form.username.value.trim().toLowerCase();
  const password = form.password.value;

  if (!roleOfUsername(username)) {
    errorMsg.textContent = "Username tidak dikenal.";
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Memeriksa...";

  try {
    await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
  } catch (err) {
    console.error("Login error:", err.code, err.message);
    errorMsg.textContent = errorText(err);
    loginBtn.disabled = false;
    loginBtn.textContent = "Masuk";
  }
});
