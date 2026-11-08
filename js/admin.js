import { db, rupiah, toast, esc, requireRole, logout } from "./common.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

await requireRole("admin");
document.getElementById("logoutBtn").onclick = logout;

const $ = (id) => document.getElementById(id);

// ================= TABS =================
document.querySelectorAll(".tab").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === btn));
    $("tab-produk").classList.toggle("hidden", btn.dataset.tab !== "produk");
    $("tab-analitik").classList.toggle("hidden", btn.dataset.tab !== "analitik");
    if (btn.dataset.tab === "analitik") renderAnalytics();
  };
});

// ================= PRODUK =================
const form = $("productForm");
let products = [];
let editingId = null;

onSnapshot(query(collection(db, "products"), orderBy("name")), (snap) => {
  products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderProducts();
});

$("productSearch").oninput = renderProducts;

function renderProducts() {
  const q = $("productSearch").value.trim().toLowerCase();
  const list = products.filter(
    (p) =>
      !q ||
      (p.name || "").toLowerCase().includes(q) ||
      (p.seller || "").toLowerCase().includes(q)
  );

  $("productRows").innerHTML = list.length
    ? list
        .map(
          (p) => `
      <tr>
        <td>${esc(p.name)}</td>
        <td>${esc(p.seller)}</td>
        <td>${rupiah(p.price)}</td>
        <td class="actions">
          <button class="btn btn-sm" data-edit="${p.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-del="${p.id}">Hapus</button>
        </td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="empty">Belum ada produk</td></tr>`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    name: form.name.value.trim(),
    seller: form.seller.value.trim(),
    price: Number(form.price.value),
  };

  if (!data.name || !data.seller || !(data.price > 0)) {
    toast("Lengkapi nama, seller, dan harga.", "error");
    return;
  }

  try {
    if (editingId) {
      await updateDoc(doc(db, "products", editingId), data);
      toast("Produk berhasil diperbarui");
    } else {
      await addDoc(collection(db, "products"), { ...data, createdAt: serverTimestamp() });
      toast("Produk berhasil ditambahkan");
    }
    resetForm();
  } catch (err) {
    toast("Gagal menyimpan: " + err.message, "error");
  }
});

$("cancelEdit").onclick = resetForm;

function resetForm() {
  form.reset();
  editingId = null;
  $("formTitle").textContent = "Tambah Produk";
  $("saveProductBtn").textContent = "Simpan Produk";
  $("cancelEdit").hidden = true;
}

$("productRows").onclick = async (e) => {
  const editBtn = e.target.closest("[data-edit]");
  const delBtn = e.target.closest("[data-del]");

  if (editBtn) {
    const p = products.find((x) => x.id === editBtn.dataset.edit);
    if (!p) return;
    editingId = p.id;
    form.name.value = p.name;
    form.seller.value = p.seller;
    form.price.value = p.price;
    $("formTitle").textContent = "Edit Produk";
    $("saveProductBtn").textContent = "Simpan Perubahan";
    $("cancelEdit").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (delBtn) {
    const p = products.find((x) => x.id === delBtn.dataset.del);
    if (!p) return;
    if (!confirm(`Hapus produk "${p.name}"?`)) return;
    try {
      await deleteDoc(doc(db, "products", p.id));
      toast("Produk dihapus");
    } catch (err) {
      toast("Gagal menghapus: " + err.message, "error");
    }
  }
};

// ================= ANALITIK =================
let orders = [];
let period = "harian";
let chart = null;

onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snap) => {
  orders = snap.docs.map((d) => {
    const x = d.data();
    return { ...x, date: x.createdAt ? x.createdAt.toDate() : new Date() };
  });
  renderAnalytics();
});

$("periodSeg").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  period = b.dataset.period;
  document.querySelectorAll("#periodSeg button").forEach((x) => x.classList.toggle("active", x === b));
  renderAnalytics();
};

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

// Senin sebagai awal minggu
function weekStart(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

const keyOf = (d, p) => (p === "harian" ? dayKey(d) : p === "mingguan" ? dayKey(weekStart(d)) : monthKey(d));

// Daftar periode yang ditampilkan: 14 hari, 9 minggu, 12 bulan terakhir
function buckets(p) {
  const now = new Date();
  const list = [];
  if (p === "harian") {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      list.push({ key: dayKey(d), label: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) });
    }
  }
  if (p === "mingguan") {
    const ws = weekStart(now);
    for (let i = 8; i >= 0; i--) {
      const d = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - 7 * i);
      list.push({ key: dayKey(d), label: "Mgg " + d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) });
    }
  }
  if (p === "bulanan") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push({ key: monthKey(d), label: d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }) });
    }
  }
  return list;
}

function renderAnalytics() {
  const now = new Date();
  const sumOf = (p, key) =>
    orders.filter((o) => keyOf(o.date, p) === key).reduce((s, o) => s + (o.total || 0), 0);

  // Ringkasan cepat (selalu tampil)
  $("sumHari").textContent = rupiah(sumOf("harian", dayKey(now)));
  $("sumMinggu").textContent = rupiah(sumOf("mingguan", dayKey(weekStart(now))));
  $("sumBulan").textContent = rupiah(sumOf("bulanan", monthKey(now)));

  // Data periode yang dipilih
  const list = buckets(period).map((b) => {
    const os = orders.filter((o) => keyOf(o.date, period) === b.key);
    return { ...b, trx: os.length, omzet: os.reduce((s, o) => s + (o.total || 0), 0) };
  });

  const keys = new Set(list.map((b) => b.key));
  const inRange = orders.filter((o) => keys.has(keyOf(o.date, period)));

  const omzet = list.reduce((s, b) => s + b.omzet, 0);
  const items = inRange.reduce((s, o) => s + (o.items || []).reduce((a, i) => a + (i.qty || 0), 0), 0);
  const cash = inRange.filter((o) => o.method === "cash").reduce((s, o) => s + (o.total || 0), 0);
  const qris = inRange.filter((o) => o.method === "qris").reduce((s, o) => s + (o.total || 0), 0);

  $("pOmzet").textContent = rupiah(omzet);
  $("pTrx").textContent = inRange.length;
  $("pItems").textContent = items;
  $("pPay").textContent = `${rupiah(cash)} / ${rupiah(qris)}`;

  $("periodRows").innerHTML = list
    .slice()
    .reverse()
    .map((b) => `<tr><td>${b.label}</td><td>${b.trx}</td><td>${rupiah(b.omzet)}</td></tr>`)
    .join("");

  // Produk terlaris
  const agg = {};
  inRange.forEach((o) => (o.items || []).forEach((i) => (agg[i.name] = (agg[i.name] || 0) + (i.qty || 0))));
  const top = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 5);
  $("topList").innerHTML = top.length
    ? top.map(([n, q]) => `<li><span>${esc(n)}</span><strong>${q} pcs</strong></li>`).join("")
    : `<li class="empty">Belum ada data</li>`;

  // Grafik
  if (chart) chart.destroy();
  chart = new Chart($("chart"), {
    type: "bar",
    data: {
      labels: list.map((b) => b.label),
      datasets: [{ label: "Omzet (Rp)", data: list.map((b) => b.omzet), backgroundColor: "#FFA500", borderRadius: 8 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}
