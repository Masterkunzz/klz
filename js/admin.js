import { db, rupiah, toast, esc, requireRole, logout, catLabel } from "./common.js";
import { openOrderEditor, initOrderEditor } from "./order-editor.js";
import {
  collection, addDoc, deleteDoc, doc, query, where, orderBy, onSnapshot, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

await requireRole("admin");
const $ = (id) => document.getElementById(id);
$("logoutBtn").onclick = logout;
initOrderEditor();

const DEFAULT_CATEGORIES = ["jajan", "jajanan utama", "minuman", "nasi", "lauk", "lainnya"];

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
function weekStart(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

// ================= TABS & MODAL =================
document.querySelectorAll(".tab").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".tab-panel").forEach((p) =>
      p.classList.toggle("hidden", p.id !== "tab-" + btn.dataset.tab)
    );
    if (btn.dataset.tab === "analitik") renderAnalytics();
    if (btn.dataset.tab === "riwayat") renderHistory();
  };
});

const openModal = (id) => $(id).classList.add("show");
const closeModal = (id) => $(id).classList.remove("show");
document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => closeModal(b.dataset.close)));

// ================= DATA MASTER & PRODUK (realtime) =================
let products = [];
let sellers = [];
let categories = [];
let orders = [];
const ready = { products: false, sellers: false, categories: false };
let synced = false;

onSnapshot(query(collection(db, "products"), orderBy("name")), (snap) => {
  products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  ready.products = true;
  maybeSync();
  refreshAll();
});

onSnapshot(query(collection(db, "sellers"), orderBy("name")), (snap) => {
  sellers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  ready.sellers = true;
  maybeSync();
  refreshAll();
});

onSnapshot(query(collection(db, "categories"), orderBy("name")), (snap) => {
  categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  ready.categories = true;
  maybeSync();
  refreshAll();
});

function refreshAll() {
  fillSelects();
  renderMaster();
  renderProducts();
  fillFilterCats();
}

/**
 * Sekali saja saat pertama kali dibuka:
 * - isi kategori default jika masih kosong
 * - buat seller & kategori otomatis dari produk lama yang belum terdaftar
 */
async function maybeSync() {
  if (synced || !(ready.products && ready.sellers && ready.categories)) return;
  synced = true;
  try {
    const catNames = new Set(categories.map((c) => c.name));
    if (!categories.length) {
      for (const c of DEFAULT_CATEGORIES) {
        await addDoc(collection(db, "categories"), { name: c, createdAt: serverTimestamp() });
        catNames.add(c);
      }
    }

    const sellerNames = new Set(sellers.map((s) => s.name.toLowerCase()));
    const missingSellers = [...new Set(products.map((p) => (p.seller || "").trim()).filter(Boolean))].filter(
      (n) => !sellerNames.has(n.toLowerCase())
    );
    for (const n of missingSellers) {
      await addDoc(collection(db, "sellers"), { name: n, createdAt: serverTimestamp() });
    }

    const missingCats = [...new Set(products.map((p) => p.category).filter(Boolean))].filter(
      (c) => !catNames.has(c)
    );
    for (const c of missingCats) {
      await addDoc(collection(db, "categories"), { name: c, createdAt: serverTimestamp() });
    }
  } catch (err) {
    console.error("Sinkronisasi master gagal:", err);
    synced = false;
  }
}

function fillSelects() {
  const sellerSel = $("sellerSelect");
  const catSel = $("categorySelect");
  const prevSeller = sellerSel.value;
  const prevCat = catSel.value;

  sellerSel.innerHTML = sellers.length
    ? sellers.map((s) => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join("")
    : `<option value="">— belum ada seller —</option>`;
  catSel.innerHTML = categories.length
    ? categories.map((c) => `<option value="${esc(c.name)}">${catLabel(c.name)}</option>`).join("")
    : `<option value="">— belum ada kategori —</option>`;

  if (prevSeller) sellerSel.value = prevSeller;
  if (prevCat) catSel.value = prevCat;
}

function fillFilterCats() {
  const sel = $("productCatFilter");
  const cur = sel.value;
  sel.innerHTML =
    `<option value="">Semua kategori</option>` +
    categories.map((c) => `<option value="${esc(c.name)}">${catLabel(c.name)}</option>`).join("");
  sel.value = cur;
}

// ---------- Master: seller & kategori ----------
function renderMaster() {
  $("sellerChips").innerHTML = sellers.length
    ? sellers
        .map((s) => {
          const n = products.filter((p) => p.seller === s.name).length;
          return `<span class="chip static">${esc(s.name)} <small>(${n})</small>
            <button class="chip-x" data-dseller="${s.id}" aria-label="Hapus">×</button></span>`;
        })
        .join("")
    : `<p class="empty">Belum ada seller</p>`;

  $("catChips").innerHTML = categories.length
    ? categories
        .map((c) => {
          const n = products.filter((p) => p.category === c.name).length;
          return `<span class="chip static">${catLabel(c.name)} <small>(${n})</small>
            <button class="chip-x" data-dcat="${c.id}" aria-label="Hapus">×</button></span>`;
        })
        .join("")
    : `<p class="empty">Belum ada kategori</p>`;
}

$("sellerForm").onsubmit = async (e) => {
  e.preventDefault();
  const name = e.target.name.value.trim();
  if (!name) return;
  if (sellers.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    toast("Seller itu sudah ada.", "error");
    return;
  }
  try {
    await addDoc(collection(db, "sellers"), { name, createdAt: serverTimestamp() });
    e.target.reset();
    toast("Seller ditambahkan");
  } catch (err) {
    toast("Gagal: " + err.message, "error");
  }
};

$("catForm").onsubmit = async (e) => {
  e.preventDefault();
  const name = e.target.name.value.trim().toLowerCase();
  if (!name) return;
  if (categories.some((c) => c.name === name)) {
    toast("Kategori itu sudah ada.", "error");
    return;
  }
  try {
    await addDoc(collection(db, "categories"), { name, createdAt: serverTimestamp() });
    e.target.reset();
    toast("Kategori ditambahkan");
  } catch (err) {
    toast("Gagal: " + err.message, "error");
  }
};

$("sellerChips").onclick = async (e) => {
  const b = e.target.closest("[data-dseller]");
  if (!b) return;
  const s = sellers.find((x) => x.id === b.dataset.dseller);
  if (!s) return;
  const used = products.filter((p) => p.seller === s.name).length;
  if (used) return toast(`Seller "${s.name}" masih dipakai ${used} produk.`, "error");
  if (!confirm(`Hapus seller "${s.name}"?`)) return;
  await deleteDoc(doc(db, "sellers", s.id));
  toast("Seller dihapus");
};

$("catChips").onclick = async (e) => {
  const b = e.target.closest("[data-dcat]");
  if (!b) return;
  const c = categories.find((x) => x.id === b.dataset.dcat);
  if (!c) return;
  const used = products.filter((p) => p.category === c.name).length;
  if (used) return toast(`Kategori "${c.name}" masih dipakai ${used} produk.`, "error");
  if (!confirm(`Hapus kategori "${c.name}"?`)) return;
  await deleteDoc(doc(db, "categories", c.id));
  toast("Kategori dihapus");
};

// ---------- Produk ----------
$("productSearch").oninput = renderProducts;
$("productCatFilter").onchange = renderProducts;

function renderProducts() {
  const q = $("productSearch").value.trim().toLowerCase();
  const cf = $("productCatFilter").value;

  const list = products.filter(
    (p) =>
      (!q || (p.name || "").toLowerCase().includes(q) || (p.seller || "").toLowerCase().includes(q)) &&
      (!cf || p.category === cf)
  );

  const groups = {};
  list.forEach((p) => {
    const s = p.seller || "Tanpa seller";
    (groups[s] ||= []).push(p);
  });

  const names = Object.keys(groups).sort();
  $("sellerGroups").innerHTML = names.length
    ? names
        .map(
          (s) => `
      <div class="card seller-group">
        <div class="row-between">
          <h3>${esc(s)}</h3>
          <span class="badge">${groups[s].length} produk</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nama Produk</th><th>Kategori</th><th>Harga</th><th></th></tr></thead>
            <tbody>
              ${groups[s]
                .map(
                  (p) => `
                <tr>
                  <td>${esc(p.name)}</td>
                  <td><span class="badge cat">${catLabel(p.category)}</span></td>
                  <td>${rupiah(p.price)}</td>
                  <td class="actions">
                    <button class="btn btn-sm" data-edit="${p.id}">Edit</button>
                    <button class="btn btn-sm btn-danger" data-del="${p.id}">Hapus</button>
                  </td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>`
        )
        .join("")
    : `<div class="card empty">Belum ada produk. Tambahkan seller dan kategori dulu di tab "Seller & Kategori".</div>`;
}

function openProductModal(p = null) {
  if (!sellers.length) return toast("Tambahkan seller dulu di tab Seller & Kategori.", "error");
  if (!categories.length) return toast("Tambahkan kategori dulu.", "error");

  const f = $("productForm");
  f.reset();
  f.dataset.id = p ? p.id : "";
  $("productModalTitle").textContent = p ? "Edit Produk" : "Tambah Produk";
  fillSelects();
  if (p) {
    f.name.value = p.name || "";
    f.seller.value = p.seller || "";
    f.category.value = p.category || "";
    f.price.value = p.price ?? "";
  }
  openModal("productModal");
  setTimeout(() => f.name.focus(), 50);
}

$("addProductBtn").onclick = () => openProductModal();

$("productForm").onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target;
  const data = {
    name: f.name.value.trim(),
    seller: f.seller.value,
    category: f.category.value,
    price: Math.round(Number(f.price.value)),
  };

  if (!data.name || !data.seller || !data.category || !(data.price >= 0)) {
    toast("Lengkapi semua field.", "error");
    return;
  }

  const id = f.dataset.id;
  const btn = $("saveProductBtn");
  btn.disabled = true;
  try {
    if (id) {
      await updateDoc(doc(db, "products", id), data);
      toast("Produk diperbarui");
    } else {
      await addDoc(collection(db, "products"), { ...data, createdAt: serverTimestamp() });
      toast("Produk ditambahkan");
    }
    closeModal("productModal");
  } catch (err) {
    toast("Gagal menyimpan: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
};

$("sellerGroups").onclick = async (e) => {
  const editBtn = e.target.closest("[data-edit]");
  const delBtn = e.target.closest("[data-del]");

  if (editBtn) {
    const p = products.find((x) => x.id === editBtn.dataset.edit);
    if (p) openProductModal(p);
  }
  if (delBtn) {
    const p = products.find((x) => x.id === delBtn.dataset.del);
    if (!p || !confirm(`Hapus produk "${p.name}"?`)) return;
    try {
      await deleteDoc(doc(db, "products", p.id));
      toast("Produk dihapus");
    } catch (err) {
      toast("Gagal menghapus: " + err.message, "error");
    }
  }
};

// ================= DATA PESANAN (realtime) =================
onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snap) => {
  orders = snap.docs.map((d) => {
    const x = d.data();
    return { ...x, id: d.id, date: x.createdAt ? x.createdAt.toDate() : new Date() };
  });
  renderHistory();
  renderAnalytics();
});

// ================= RIWAYAT PENJUALAN =================
$("hFrom").value = dayKey(new Date());
$("hTo").value = dayKey(new Date());
["hFrom", "hTo", "hMethod"].forEach((id) => ($(id).onchange = renderHistory));

function renderHistory() {
  const from = new Date($("hFrom").value + "T00:00:00");
  const to = new Date($("hTo").value + "T23:59:59.999");
  const method = $("hMethod").value;

  const list = orders.filter((o) => o.date >= from && o.date <= to && (!method || o.method === method));
  const sum = list.reduce((s, o) => s + (o.total || 0), 0);
  $("historyCount").textContent = `${list.length} transaksi · total ${rupiah(sum)}`;

  $("historyRows").innerHTML = list.length
    ? list
        .map(
          (o) => `
      <tr>
        <td>${esc(o.no || "-")}</td>
        <td>${o.date.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
        <td class="wrap">${(o.items || []).map((i) => `${esc(i.name)} ×${i.qty}`).join(", ")}</td>
        <td>${rupiah(o.total)}</td>
        <td>${rupiah(o.paid)}</td>
        <td>${rupiah(o.change)}</td>
        <td><span class="badge ${o.method}">${(o.method || "-").toUpperCase()}</span></td>
        <td>${esc(o.kasir || "-")}</td>
        <td class="actions">
          <button class="btn btn-sm" data-oedit="${o.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-odel="${o.id}">Hapus</button>
        </td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="9" class="empty">Tidak ada transaksi di rentang ini</td></tr>`;
}

$("historyRows").onclick = async (e) => {
  const editBtn = e.target.closest("[data-oedit]");
  const delBtn = e.target.closest("[data-odel]");

  if (editBtn) {
    const o = orders.find((x) => x.id === editBtn.dataset.oedit);
    if (o) openOrderEditor(o);
  }
  if (delBtn) {
    const o = orders.find((x) => x.id === delBtn.dataset.odel);
    if (!o || !confirm(`Hapus transaksi ${o.no}? Data tidak bisa dikembalikan.`)) return;
    try {
      await deleteDoc(doc(db, "orders", o.id));
      toast("Transaksi dihapus");
    } catch (err) {
      toast("Gagal menghapus: " + err.message, "error");
    }
  }
};

// ================= ANALITIK =================
let period = "harian";
let chart = null;

const keyOf = (d, p) => (p === "harian" ? dayKey(d) : p === "mingguan" ? dayKey(weekStart(d)) : monthKey(d));

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

$("periodSeg").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  period = b.dataset.period;
  document.querySelectorAll("#periodSeg button").forEach((x) => x.classList.toggle("active", x === b));
  renderAnalytics();
};

function renderAnalytics() {
  const now = new Date();
  const sumOf = (p, key) =>
    orders.filter((o) => keyOf(o.date, p) === key).reduce((s, o) => s + (o.total || 0), 0);

  $("sumHari").textContent = rupiah(sumOf("harian", dayKey(now)));
  $("sumMinggu").textContent = rupiah(sumOf("mingguan", dayKey(weekStart(now))));
  $("sumBulan").textContent = rupiah(sumOf("bulanan", monthKey(now)));

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

  const agg = {};
  inRange.forEach((o) => (o.items || []).forEach((i) => (agg[i.name] = (agg[i.name] || 0) + (i.qty || 0))));
  const top = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 5);
  $("topList").innerHTML = top.length
    ? top.map(([n, q]) => `<li><span>${esc(n)}</span><strong>${q} pcs</strong></li>`).join("")
    : `<li class="empty">Belum ada data</li>`;

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
