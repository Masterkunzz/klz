import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ADMIN_USERNAME, KASIR_USERNAME, EMAIL_DOMAIN } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const ROLES = { [ADMIN_USERNAME]: "admin", [KASIR_USERNAME]: "kasir" };
export const ROLE_PAGE = { admin: "admin.html", kasir: "kasir.html" };

export const usernameToEmail = (u) => `${u.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
export const roleOfUsername = (u) => ROLES[u.trim().toLowerCase()] || null;

/**
 * Menerima username (kasirklz) ATAU email lengkap (kasirklz@klz.app).
 * Mengembalikan { email, role } atau null jika tidak dikenali.
 */
export function resolveLogin(input) {
  const v = input.trim().toLowerCase();
  if (v.includes("@")) {
    const [name, domain] = v.split("@");
    const role = domain === EMAIL_DOMAIN ? roleOfUsername(name) : null;
    return role ? { email: v, role } : null;
  }
  const role = roleOfUsername(v);
  return role ? { email: usernameToEmail(v), role } : null;
}

export function roleOfUser(user) {
  if (!user || !user.email) return null;
  const [name, domain] = user.email.split("@");
  return domain === EMAIL_DOMAIN ? roleOfUsername(name) : null;
}

/**
 * Melindungi halaman. Jika belum login / role tidak cocok,
 * pengguna diarahkan ke halaman login.
 */
export function requireRole(role) {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user && roleOfUser(user) === role) {
        document.body.classList.add("ready");
        resolve(user);
      } else {
        location.replace("index.html");
      }
    });
  });
}

export async function logout() {
  await signOut(auth);
  location.replace("index.html");
}

export const rupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

export function toast(msg, type = "ok") {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("hide"), 2200);
  setTimeout(() => t.remove(), 2700);
}
