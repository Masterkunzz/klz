import { db, rupiah, toast, esc, requireRole, logout, catLabel, playCashSound } from "./common.js";
import { initOrderEditor, openOrderEditor } from "./order-editor.js";
import {
  collection, addDoc, query, orderBy, where, onSnapshot, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const user = await requireRole("kasir");
const $ = (id) => document.getElementById(id);
$("logoutBtn").onclick = logout;
initOrderEditor();

let products = [];
let sellers = [];
let cart = [];
let method = "cash";
let selSeller = "semua";
let selCat = "semua";

// ================= DATA (realtime) =================
onSnapshot(query(collection(db, "products"), orderBy("name")), (snap) => {
  products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderSellers();
  renderCats();
  renderGrid();
});

onSnapshot(query(collection(db, "sellers"), orderBy("name")), (snap) => {
  sellers = snap.docs.map((d) => d.data().name);
  renderSellers();
});

// ================= RIWAYAT TRANSAKSI (per tanggal) =================
let unsubDay = null;
let dayOrders = [];

const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
$("histDate").value = dayStr(new Date());
$("histDate").onchange = () => loadDay($("histDate").value);
loadDay($("histDate").value);

function loadDay(value) {
  if (unsubDay) unsubDay();
  const start = new Date(value + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  unsubDay = onSnapshot(
    query(
      collection(db, "orders"),
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<", Timestamp.fromDate(end))
    ),
    (snap) => {
      dayOrders = snap.docs
        .map((d) => {
          const x = d.data();
          return { ...x, id: d.id, date: x.createdAt ? x.createdAt.toDate() : new Date() };
        })
        .sort((a, b) => b.date - a.date);
      renderDay();
    }
  );
}

function renderDay() {
  const total = dayOrders.reduce((s, o) => s + (o.total || 0), 0);
  $("dayCount").textContent = dayOrders.length;
  $("dayTotal").textContent = rupiah(total);

  $("histList").innerHTML = dayOrders.length
    ? dayOrders
        .map(
          (o) => `
      <li>
        <div class="ci-info">
          <strong>${o.date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · ${esc(o.no || "-")}</strong>
          <small>${(o.items || []).map((i) => `${esc(i.name)} ×${i.qty}`).join(", ")}</small>
        </div>
        <div class="hist-right">
          <strong>${rupiah(o.total)}</strong>
          <span class="badge ${o.method}">${(o.method || "-").toUpperCase()}</span>
        </div>
        <button class="btn btn-sm" data-oedit="${o.id}">Edit</button>
      </li>`
        )
        .join("")
    : `<li class="empty">Belum ada transaksi di tanggal ini</li>`;
}

$("histList").onclick = (e) => {
  const b = e.target.closest("[data-oedit]");
  if (!b) return;
  const o = dayOrders.find((x) => x.id === b.dataset.oedit);
  if (o) openOrderEditor(o);
};

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

// ================= SELLER STRIP (bisa di-drag / di-scroll) =================
const strip = $("sellerStrip");
let dragging = false;
let dragMoved = false;
let startX = 0;
let startLeft = 0;

strip.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "mouse") return;
  dragging = true;
  dragMoved = false;
  startX = e.clientX;
  startLeft = strip.scrollLeft;
});
window.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - startX;
  if (Math.abs(dx) > 5) dragMoved = true;
  strip.scrollLeft = startLeft - dx;
});
window.addEventListener("pointerup", () => (dragging = false));

function sellerNames() {
  return [...new Set([...sellers, ...products.map((p) => p.seller).filter(Boolean)])].sort();
}

function renderSellers() {
  strip.innerHTML =
    `<button class="chip ${selSeller === "semua" ? "active" : ""}" data-seller="semua">Semua</button>` +
    sellerNames()
      .map(
        (n) =>
          `<button class="chip ${selSeller === n ? "active" : ""}" data-seller="${esc(n)}">${esc(n)}</button>`
      )
      .join("");
}

strip.onclick = (e) => {
  if (dragMoved) return;
  const b = e.target.closest("[data-seller]");
  if (!b) return;
  selSeller = b.dataset.seller;
  selCat = "semua";
  renderSellers();
  renderCats();
  renderGrid();
};

// ================= KATEGORI (hanya milik seller terpilih) =================
function productsOfSeller() {
  return selSeller === "semua" ? products : products.filter((p) => p.seller === selSeller);
}

function renderCats() {
  const cats = [...new Set(productsOfSeller().map((p) => p.category || "lainnya"))].sort();
  if (selCat !== "semua" && !cats.includes(selCat)) selCat = "semua";

  $("catChips").innerHTML =
    `<button class="chip ${selCat === "semua" ? "active" : ""}" data-cat="semua">Semua</button>` +
    cats
      .map((c) => `<button class="chip ${selCat === c ? "active" : ""}" data-cat="${esc(c)}">${catLabel(c)}</button>`)
      .join("");
}

$("catChips").onclick = (e) => {
  const b = e.target.closest("[data-cat]");
  if (!b) return;
  selCat = b.dataset.cat;
  renderCats();
  renderGrid();
};

// ================= GRID PRODUK =================
$("search").oninput = renderGrid;

function renderGrid() {
  const q = $("search").value.trim().toLowerCase();
  const list = productsOfSeller().filter(
    (p) =>
      (!q || (p.name || "").toLowerCase().includes(q) || (p.seller || "").toLowerCase().includes(q)) &&
      (selCat === "semua" || (p.category || "lainnya") === selCat)
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
    : `<p class="empty">${products.length ? "Tidak ada produk di filter ini" : "Belum ada produk. Tambahkan lewat halaman admin."}</p>`;
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
  selSeller = "semua";
  selCat = "semua";
  $("paid").value = "";
  $("search").value = "";
  document.querySelectorAll("#paySeg button").forEach((x) =>
    x.classList.toggle("active", x.dataset.method === "cash")
  );
  renderSellers();
  renderCats();
  renderGrid();
  renderCart();
}

renderSellers();
renderCats();
renderGrid();
renderCart();
