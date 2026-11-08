import { db, rupiah, toast, esc, requireRole, logout, CATEGORIES, catLabel } from "./common.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

await requireRole("admin");
const $ = (id) => document.getElementById(id);
$("logoutBtn").onclick = logout;

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

// Isi pilihan kategori
$("categorySelect").innerHTML = CATEGORIES.map((c) => `<option value="${c}">${catLabel(c)}</option>`).join("");
$("productCatFilter").insertAdjacentHTML(
  "beforeend",
  CATEGORIES.map((c) => `<option value="${c}">${catLabel(c)}</option>`).join("")
);

// ================= PRODUK =================
let products = [];
let editingId = null;

onSnapshot(query(collection(db, "products"), orderBy("name")), (snap) => {
  products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const sellers = [...new Set(products.map((p) => p.seller).filter(Boolean))].sort();
  $("sellerList").innerHTML = sellers.map((s) => `<option value="${esc(s)}">`).join("");
  renderProducts();
});

$("productSearch").oninput = renderProducts;
$("productCatFilter").onchange = renderProducts;

function renderProducts() {
  const q = $("productSearch").value.trim().toLowerCase();
  const cf = $("productCatFilter").value;

  const list = products.filter(
    (p) =>
      (!q || (p.name || "").toLowerCase().includes(q) || (p.seller || "").toLowerCase().includes(q)) &&
      (!cf || (p.category || "lainnya") === cf)
  );

  // Kelompokkan per seller
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
    : `<div class="card empty">Belum ada produk. Tekan "+ Tambah Produk".</div>`;
}

function openProductModal(p = null) {
  editingId = p ? p.id : null;
  const f = $("productForm");
  f.reset();
  $("productModalTitle").textContent = p ? "Edit Produk" : "Tambah Produk";
  if (p) {
    f.name.value = p.name || "";
    f.seller.value = p.seller || "";
    f.price.value = p.price ?? "";
    f.category.value = p.category || "lainnya";
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
    seller: f.seller.value.trim(),
    price: Math.round(Number(f.price.value)),
    category: f.category.value,
  };

  if (!data.name || !data.seller || !(data.price >= 0) || !CATEGORIES.includes(data.category)) {
    toast("Lengkapi nama, seller, harga, dan kategori.", "error");
    return;
  }

  const btn = $("saveProductBtn");
  btn.disabled = true;
  try {
    if (editingId) {
      await updateDoc(doc(db, "products", editingId), data);
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
let orders = [];

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

  const list = orders.filter(
    (o) => o.date >= from && o.date <= to && (!method || o.method === method)
  );
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

// ---- Edit pesanan (ralat) ----
let editOrder = null;

function openOrderEdit(o) {
  editOrder = {
    id: o.id,
    no: o.no,
    items: (o.items || []).map((i) => ({ ...i })),
    method: o.method || "cash",
    paid: o.paid || 0,
  };
  renderOrderEdit();
  openModal("orderModal");
}

const orderTotal = () => editOrder.items.reduce((s, i) => s + i.price * i.qty, 0);

function renderOrderEdit() {
  $("oeNo").textContent = "No. " + (editOrder.no || "-");
  $("oeItems").innerHTML = editOrder.items.length
    ? editOrder.items
        .map(
          (i, idx) => `
      <li>
        <div class="ci-info"><strong>${esc(i.name)}</strong><small>${rupiah(i.price)} / pcs</small></div>
        <div class="qty">
          <button type="button" data-oact="dec" data-idx="${idx}">−</button>
          <span>${i.qty}</span>
          <button type="button" data-oact="inc" data-idx="${idx}">+</button>
        </div>
        <button type="button" class="icon-del" data-oact="del" data-idx="${idx}">✕</button>
      </li>`
        )
        .join("")
    : `<li class="empty">Semua item dihapus</li>`;

  document.querySelectorAll("#oeMethod button").forEach((b) =>
    b.classList.toggle("active", b.dataset.m === editOrder.method)
  );
  $("oePaid").value = editOrder.paid;
  updateOrderEditTotals();
}

function updateOrderEditTotals() {
  const t = orderTotal();
  if (editOrder.method === "qris") {
    editOrder.paid = t;
    $("oePaid").value = t;
  }
  const change = editOrder.paid - t;
  $("oeTotal").textContent = rupiah(t);
  $("oeChange").textContent = change < 0 ? "Kurang " + rupiah(-change) : rupiah(change);
  $("oeChange").classList.toggle("bad", change < 0);
  $("oeSave").disabled = !editOrder.items.length || change < 0;
}

$("oeItems").onclick = (e) => {
  const b = e.target.closest("[data-oact]");
  if (!b) return;
  const idx = Number(b.dataset.idx);
  const it = editOrder.items[idx];
  if (b.dataset.oact === "del") {
    editOrder.items.splice(idx, 1);
  } else if (it) {
    it.qty += b.dataset.oact === "inc" ? 1 : -1;
    if (it.qty <= 0) editOrder.items.splice(idx, 1);
  }
  renderOrderEdit();
};

$("oeMethod").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  editOrder.method = b.dataset.m;
  renderOrderEdit();
};

$("oePaid").oninput = (e) => {
  editOrder.paid = Number(e.target.value || 0);
  updateOrderEditTotals();
};

$("oeSave").onclick = async () => {
  const t = orderTotal();
  if (!editOrder.items.length || editOrder.paid < t) return;

  const items = editOrder.items.map((i) => ({
    id: i.id,
    name: i.name,
    seller: i.seller || "",
    price: i.price,
    qty: i.qty,
    subtotal: i.price * i.qty,
  }));

  try {
    await updateDoc(doc(db, "orders", editOrder.id), {
      items,
      total: t,
      paid: editOrder.paid,
      change: editOrder.paid - t,
      method: editOrder.method,
      editedAt: serverTimestamp(),
    });
    toast("Pesanan diperbarui");
    closeModal("orderModal");
  } catch (err) {
    toast("Gagal menyimpan: " + err.message, "error");
  }
};

$("historyRows").onclick = async (e) => {
  const editBtn = e.target.closest("[data-oedit]");
  const delBtn = e.target.closest("[data-odel]");

  if (editBtn) {
    const o = orders.find((x) => x.id === editBtn.dataset.oedit);
    if (o) openOrderEdit(o);
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
