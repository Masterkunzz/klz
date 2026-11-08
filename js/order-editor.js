import { db, rupiah, toast, esc } from "./common.js";
import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
let work = null;

const total = () => work.items.reduce((s, i) => s + i.price * i.qty, 0);

/** Buka popup edit untuk satu transaksi */
export function openOrderEditor(o) {
  work = {
    id: o.id,
    no: o.no,
    items: (o.items || []).map((i) => ({ ...i })),
    method: o.method || "cash",
    paid: o.paid || 0,
  };
  render();
  $("orderModal").classList.add("show");
}

function closeEditor() {
  $("orderModal").classList.remove("show");
}

function render() {
  $("oeNo").textContent = "No. " + (work.no || "-");
  $("oeItems").innerHTML = work.items.length
    ? work.items
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
    b.classList.toggle("active", b.dataset.m === work.method)
  );
  $("oePaid").value = work.paid;
  recalc();
}

function recalc() {
  const t = total();
  if (work.method === "qris") {
    work.paid = t;
    $("oePaid").value = t;
  }
  const change = work.paid - t;
  $("oeTotal").textContent = rupiah(t);
  $("oeChange").textContent = change < 0 ? "Kurang " + rupiah(-change) : rupiah(change);
  $("oeChange").classList.toggle("bad", change < 0);
  $("oeSave").disabled = !work.items.length || change < 0;
}

/** Pasang event handler popup. Panggil sekali per halaman. */
export function initOrderEditor() {
  document.querySelectorAll("#orderModal [data-close]").forEach((b) => (b.onclick = closeEditor));

  $("oeItems").onclick = (e) => {
    const b = e.target.closest("[data-oact]");
    if (!b) return;
    const idx = Number(b.dataset.idx);
    const it = work.items[idx];
    if (b.dataset.oact === "del") {
      work.items.splice(idx, 1);
    } else if (it) {
      it.qty += b.dataset.oact === "inc" ? 1 : -1;
      if (it.qty <= 0) work.items.splice(idx, 1);
    }
    render();
  };

  $("oeMethod").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    work.method = b.dataset.m;
    render();
  };

  $("oePaid").oninput = (e) => {
    work.paid = Number(e.target.value || 0);
    recalc();
  };

  $("oeSave").onclick = async () => {
    const t = total();
    if (!work.items.length || work.paid < t) return;

    const items = work.items.map((i) => ({
      id: i.id,
      name: i.name,
      seller: i.seller || "",
      price: i.price,
      qty: i.qty,
      subtotal: i.price * i.qty,
    }));

    try {
      await updateDoc(doc(db, "orders", work.id), {
        items,
        total: t,
        paid: work.paid,
        change: work.paid - t,
        method: work.method,
        editedAt: serverTimestamp(),
      });
      toast("Transaksi diperbarui");
      closeEditor();
    } catch (err) {
      toast("Gagal menyimpan: " + err.message, "error");
    }
  };
}
