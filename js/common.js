import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ADMIN_USERNAME, KASIR_USERNAME, EMAIL_DOMAIN } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Kategori produk (dipakai di form produk dan filter kasir)
export const CATEGORIES = ["jajan", "minuman", "nasi", "lauk", "lainnya"];
export const catLabel = (c) => (c ? c.charAt(0).toUpperCase() + c.slice(1) : "Lainnya");

const ROLES = { [ADMIN_USERNAME]: "admin", [KASIR_USERNAME]: "kasir" };
export const ROLE_PAGE = { admin: "admin.html", kasir: "kasir.html" };

export const usernameToEmail = (u) => `${u.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
export const roleOfUsername = (u) => ROLES[u.trim().toLowerCase()] || null;

export function roleOfUser(user) {
  if (!user || !user.email) return null;
  const [name, domain] = user.email.split("@");
  return domain === EMAIL_DOMAIN ? roleOfUsername(name) : null;
}

/** Melindungi halaman: jika belum login / role tidak cocok → ke login */
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

// ================= SUARA KASIR =================
// Jika ada file assets/cash.mp3, file itu yang diputar.
// Jika tidak ada, suara "ting-ting-cling" dibuat otomatis oleh browser.
let audioCtx = null;

export function playCashSound() {
  const audio = new Audio("assets/cash.mp3");
  audio.play().catch(() => synthCash());
}

function synthCash() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t0 = audioCtx.currentTime;

    const ding = (freq, start, dur, vol) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "triangle";
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t0 + start);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + start + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + start);
      o.stop(t0 + start + dur);
    };
    ding(1568, 0, 0.25, 0.3);
    ding(2093, 0.12, 0.35, 0.3);
    ding(2637, 0.24, 0.5, 0.25);

    // "cling" laci: letupan noise singkat
    const len = Math.floor(audioCtx.sampleRate * 0.08);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audioCtx.createBufferSource();
    const g = audioCtx.createGain();
    g.gain.value = 0.4;
    src.buffer = buf;
    src.connect(g).connect(audioCtx.destination);
    src.start(t0 + 0.05);
  } catch (e) {
    /* browser tanpa audio: abaikan */
  }
}
