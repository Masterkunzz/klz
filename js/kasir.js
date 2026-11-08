import { db, rupiah, toast, esc, requireRole, logout, catLabel, playCashSound } from "./common.js";
import {
  collection, addDoc, query, orderBy, where, onSnapshot, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const user = await requireRole("kasir");
const $ = (id) => document.getElementById(id);
$("logoutBtn").onclick = logout;

let products = [];
let cart = [];
let method = "cash";
let category = "semua";

// ================= DATA PRODUK (realtime) =================
onSnapshot(query(collection(db, "products"), orderBy("name")), (snap) => {
  products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderGrid();
});

// ================= STATISTIK HARI INI =================
const startOfDay = new Date();
startOfDay.setHours(0, 0, 0, 0);

onSnapshot(
  query(collection(db, "orders"), where("createdAt", ">=", Timestamp.fromDate(startOfDay))),
  (snap) => {
    let total = 0;
    snap.forEach((d) => (total += d.data().total || 0));
    $("todayCount").textContent = snap.size;
    $("todayTotal").textContent = rupiah(total);
  }
);

// ================= NAVIGASI =================
function showView(v) {
  $("viewHome").classList.toggle("hidden", v !== "home");
  $("viewOrder").classList.toggle("hidden", v !== "order");
  window.scrollTo({ top: 0 });
}

$("newOrderBtn").onclick = () => showView("order");

$("backBtn").onclick = () => {
  if (cart.length && !confirm("Batalkan pesanan ini?")) return;
  resetOrder();
  showView("home");
};

// ================= FILTER & GRID PRODUK =================
$("search").oninput = renderGrid;

$("catChips").onclick = (e) => {
  const b = e.target.closest("[data-cat]");
  if (!b) return;
  category = b.dataset.cat;
  document.querySelectorAll("#catChips .chip").forEach((c) => c.classList.toggle("active", c === b));
  renderGrid();
};

function renderGrid() {
  const q = $("search").value.trim().toLowerCase();
  const list = products.filter(
    (p) =>
      (!q || (p.name || "").toLowerCase().includes(q) || (p.seller || "").toLowerCase().includes(q)) &&
      (category === "semua" || (p.category || "lainnya") === category)
  );

  $("productGrid").innerHTML = list.length
    ? list
        .map(
          (p) => `
        <button class="pbox" data-id="${p.id}">
          <span class="pcat">${catLabel(p.category)}</span>
          <span class="pname">${esc(p.name)}</span>
          <span class="pseller">${esc(p.seller)}</span>
          <span class="pprice">${rupiah(p.price)}</span>
        </button>`
        )
        .join("")
    : `<p class="empty">${
        products.length ? "Tidak ada produk di filter ini" : "Belum ada produk. Tambahkan lewat halaman admin."
      }</p>`;
}

$("productGrid").onclick = (e) => {
  const box = e.target.closest("[data-id]");
  if (!box) return;
  const p = products.find((x) => x.id === box.dataset.id);
  if (!p) return;

  const item = cart.find((i) => i.id === p.id);
  if (item) item.qty++;
  else cart.push({ id: p.id, name: p.name, seller: p.seller, price: Number(p.price), qty: 1 });

  renderCart();
};

// ================= KERANJANG =================
const total = () => cart.reduce((s, i) => s + i.price * i.qty, 0);

function renderCart() {
  $("cartList").innerHTML = cart.length
    ? cart
        .map(
          (i) => `
        <li>
          <div class="ci-info">
            <strong>${esc(i.name)}</strong>
            <small>${rupiah(i.price)} × ${i.qty} = ${rupiah(i.price * i.qty)}</small>
          </div>
          <div class="qty">
            <button data-act="dec" data-id="${i.id}">−</button>
            <span>${i.qty}</span>
            <button data-act="inc" data-id="${i.id}">+</button>
          </div>
          <button class="icon-del" data-act="del" data-id="${i.id}" aria-label="Hapus">✕</button>
        </li>`
        )
        .join("")
    : `<li class="empty">Pilih produk di sebelah kiri</li>`;

  if (method === "qris") $("paid").value = total() || "";
  updateTotals();
}

$("cartList").onclick = (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const item = cart.find((i) => i.id === btn.dataset.id);
  if (!item) return;

  const act = btn.dataset.act;
  if (act === "del") cart = cart.filter((i) => i !== item);
  else {
    item.qty += act === "inc" ? 1 : -1;
    if (item.qty <= 0) cart = cart.filter((i) => i !== item);
  }
  renderCart();
};

function updateTotals() {
  const t = total();
  const paid = Number($("paid").value || 0);
  const change = paid - t;

  $("total").textContent = rupiah(t);

  if (paid > 0 && change < 0) {
    $("change").textContent = "Kurang " + rupiah(-change);
    $("change").classList.add("bad");
  } else {
    $("change").textContent = rupiah(paid > 0 ? change : 0);
    $("change").classList.remove("bad");
  }

  $("saveBtn").disabled = !(cart.length && t > 0 && paid >= t);
}

$("paid").oninput = updateTotals;

$("quick").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  $("paid").value = b.dataset.amt ? Number(b.dataset.amt) : total();
  updateTotals();
};

$("paySeg").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  method = b.dataset.method;
  document.querySelectorAll("#paySeg button").forEach((x) => x.classList.toggle("active", x === b));
  if (method === "qris") $("paid").value = total() || "";
  updateTotals();
};

// ================= SIMPAN PESANAN =================
$("saveBtn").onclick = async () => {
  const t = total();
  const paid = Number($("paid").value || 0);
  if (!cart.length || paid < t) return;

  const btn = $("saveBtn");
  btn.disabled = true;
  btn.textContent = "Menyimpan...";

  const orderNo = "KLZ-" + Date.now().toString(36).toUpperCase().slice(-6);

  try {
    await addDoc(collection(db, "orders"), {
      no: orderNo,
      items: cart.map((i) => ({
        id: i.id,
        name: i.name,
        seller: i.seller,
        price: i.price,
        qty: i.qty,
        subtotal: i.price * i.qty,
      })),
      total: t,
      paid,
      change: paid - t,
      method,
      kasir: user.email.split("@")[0],
      createdAt: serverTimestamp(),
    });

    playCashSound();
    $("successInfo").innerHTML = `No. ${orderNo}<br>Kembalian: <strong>${rupiah(paid - t)}</strong>`;
    $("successOverlay").classList.add("show");
  } catch (err) {
    toast("Gagal menyimpan: " + err.message, "error");
  } finally {
    btn.textContent = "Simpan Pesanan";
    updateTotals();
  }
};

$("closeSuccess").onclick = () => {
  $("successOverlay").classList.remove("show");
  resetOrder();
  showView("home");
};

function resetOrder() {
  cart = [];
  method = "cash";
  category = "semua";
  $("paid").value = "";
  $("search").value = "";
  document.querySelectorAll("#paySeg button").forEach((x) =>
    x.classList.toggle("active", x.dataset.method === "cash")
  );
  document.querySelectorAll("#catChips .chip").forEach((c) =>
    c.classList.toggle("active", c.dataset.cat === "semua")
  );
  renderGrid();
  renderCart();
}

renderGrid();
renderCart();
