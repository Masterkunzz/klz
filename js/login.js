import { auth, usernameToEmail, roleOfUsername, roleOfUser, ROLE_PAGE } from "./common.js";
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

  const username = form.username.value.trim().toLowerCase();
  const password = form.password.value;

  if (!roleOfUsername(username)) {
    errorMsg.textContent = "Username atau password salah.";
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Memeriksa...";

  try {
    await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
    // Redirect ditangani oleh onAuthStateChanged di atas
  } catch (err) {
    errorMsg.textContent =
      err.code === "auth/network-request-failed"
        ? "Tidak ada koneksi internet."
        : "Username atau password salah.";
    loginBtn.disabled = false;
    loginBtn.textContent = "Masuk";
  }
});
