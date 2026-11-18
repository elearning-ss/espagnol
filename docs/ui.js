// Composants d'interface : fenêtres, confirmations, menu contextuel, glisser-déposer.
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- fenêtre (modal) ---------- */
export function modal({ title = "", body = "", buttons = [{ label: "OK", primary: true }], wide = false, onOpen } = {}) {
  const ov = document.createElement("div");
  ov.className = "ov";
  ov.innerHTML = `<div class="dlg ${wide ? "wide" : ""}" role="dialog" aria-modal="true"><div class="dlg-h"><b>${title}</b><button class="x" aria-label="Fermer">✕</button></div><div class="dlg-b"></div><div class="dlg-f"></div></div>`;
  document.body.appendChild(ov);
  const b = ov.querySelector(".dlg-b"), f = ov.querySelector(".dlg-f");
  const closers = [];
  let done;
  const result = new Promise(r => done = r);
  const close = v => { if (!ov.isConnected) return; ov.remove(); document.removeEventListener("keydown", key); closers.forEach(c => c()); done(v); };
  const setBody = h => { b.innerHTML = ""; typeof h === "string" ? b.innerHTML = h : b.appendChild(h); };
  setBody(body);
  buttons.forEach((bt, i) => {
    const e = document.createElement("button");
    e.className = "btn " + (bt.primary ? "" : bt.danger ? "danger" : "ghost"); e.innerHTML = bt.label;
    e.onclick = async () => { const v = bt.act ? await bt.act(api) : (bt.value ?? i); if (v !== false) close(v); };
    f.appendChild(e);
  });
  const key = e => {
    if (e.key === "Escape") close(null);
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && !e.target.closest(".rte")) { const p = f.querySelector(".btn:not(.ghost):not(.danger)") || f.querySelector(".btn.danger"); if (p && b.contains(e.target)) { e.preventDefault(); p.click(); } }
  };
  document.addEventListener("keydown", key);
  ov.querySelector(".x").onclick = () => close(null);
  ov.addEventListener("pointerdown", e => { if (e.target === ov) close(null); });
  const api = { el: ov, body: b, setBody, close, result, onClose: fn => closers.push(fn) };
  setTimeout(() => { (b.querySelector("input,textarea,select") || f.querySelector(".btn:not(.ghost)"))?.focus(); onOpen && onOpen(api); });
  return api;
}
export const confirmDlg = (msg, { ok = "Confirmer", danger = false, title = "Confirmation" } = {}) =>
  modal({ title, body: `<p>${msg}</p>`, buttons: [{ label: "Annuler", value: false }, { label: ok, value: true, primary: !danger, danger }] }).result.then(v => v === true);
export function promptDlg(title, value = "", { placeholder = "", ok = "OK", label = "" } = {}) {
  const m = modal({ title, body: `${label ? `<label class="f">${label}</label>` : ""}<input type="text" id="dlg_in" value="${esc(value)}" placeholder="${esc(placeholder)}">`, buttons: [{ label: "Annuler", value: null }, { label: ok, primary: true, act: a => a.body.querySelector("#dlg_in").value.trim() || false }] });
  setTimeout(() => { const i = m.body.querySelector("#dlg_in"); i && i.select(); });
  return m.result.then(v => typeof v === "string" ? v : null);
}
export function choiceDlg(title, msg, choices) {
  return modal({ title, body: `<p>${msg}</p>`, buttons: [{ label: "Annuler", value: null }, ...choices.map((c, i) => ({ label: c.label, value: c.value, primary: i === choices.length - 1 }))] }).result;
}

/* ---------- toast ---------- */
export function toast(msg, ms = 2400) {
  document.querySelectorAll(".toast").forEach(x => x.remove());
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}

/* ---------- menu contextuel ---------- */
export function menu(x, y, items) {
  document.querySelectorAll(".ctx").forEach(e => e.remove());
  const m = document.createElement("div");
  m.className = "ctx";
  m.innerHTML = items.map((it, i) => it === "-" ? `<hr>` : `<button data-i="${i}" ${it.disabled ? "disabled" : ""} class="${it.danger ? "dg" : ""}"><span>${it.icon || ""}</span>${esc(it.label)}${it.hint ? `<small>${esc(it.hint)}</small>` : ""}</button>`).join("");
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(6, Math.min(x, innerWidth - r.width - 6)) + "px";
  m.style.top = Math.max(6, Math.min(y, innerHeight - r.height - 6)) + "px";
  const close = () => { m.remove(); document.removeEventListener("pointerdown", out, true); document.removeEventListener("keydown", esc_); window.removeEventListener("scroll", close, true); };
  const out = e => { if (!m.contains(e.target)) close(); };
  const esc_ = e => { if (e.key === "Escape") close(); };
  setTimeout(() => { document.addEventListener("pointerdown", out, true); document.addEventListener("keydown", esc_); window.addEventListener("scroll", close, true); });
  m.onclick = e => { const b = e.target.closest("[data-i]"); if (!b) return; close(); items[+b.dataset.i].act(); };
}

/* ---------- glisser-déposer universel (souris + tactile) ----------
   draggable(root, { selector, handle?, payload(el) → objet|null, label?(payload) })
   dropZone(el, { list?: true, item?: sélecteur des enfants, accept(payload) → bool, drop(payload, index, el) })
   - zone « liste » : on insère à une position (ligne d'insertion) ;
   - zone « cible » : on dépose dessus (surbrillance), ex. un dossier. */
let D = null;
export function dropZone(el, opts) { el._dz = opts; el.setAttribute("data-dz", ""); }
export function draggable(root, opts) {
  root.addEventListener("pointerdown", e => {
    if (e.button > 0) return;
    const el = e.target.closest(opts.selector); if (!el || !root.contains(el)) return;
    if (opts.handle && !e.target.closest(opts.handle)) return;
    if (!opts.handle && e.target.closest("input,textarea,select,button:not([data-dragok]),a,.sw")) return;
    const payload = opts.payload(el); if (!payload) return;
    const sx = e.clientX, sy = e.clientY, pid = e.pointerId;
    const touch = e.pointerType === "touch";
    let started = false, timer = null;
    if (opts.handle) e.preventDefault();
    const start = () => {
      started = true;
      const g = document.createElement("div"); g.className = "dnd-ghost";
      g.innerHTML = opts.label ? opts.label(payload, el) : el.innerText.split("\n")[0].slice(0, 60);
      document.body.appendChild(g);
      D = { payload, ghost: g, src: el, zone: null, ph: null, index: -1 };
      el.classList.add("dragging"); document.body.classList.add("is-dragging");
      try { el.setPointerCapture(pid); } catch (er) {}
    };
    const move = ev => {
      if (ev.pointerId !== pid) return;
      if (!started) {
        const d = Math.hypot(ev.clientX - sx, ev.clientY - sy);
        if (touch && !opts.handle) { if (d > 10) cleanup(); return; } // sur mobile sans poignée : appui long
        if (d > 6) start(); else return;
      }
      ev.preventDefault();
      D.ghost.style.transform = `translate(${ev.clientX + 12}px,${ev.clientY + 8}px)`;
      autoscroll(ev);
      hover(ev.clientX, ev.clientY);
    };
    const up = ev => {
      if (ev.pointerId !== pid) return;
      clearTimeout(timer);
      if (started && D) {
        const z = D.zone, i = D.index, p = D.payload;
        clear();
        if (z) z._dz.drop(p, i, z);
        // évite le « clic » qui suit le dépôt
        const stop = c => { c.stopPropagation(); c.preventDefault(); window.removeEventListener("click", stop, true); };
        window.addEventListener("click", stop, true); setTimeout(() => window.removeEventListener("click", stop, true), 50);
      }
      cleanup();
    };
    const cleanup = () => { clearTimeout(timer); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
    if (touch && !opts.handle) timer = setTimeout(() => { start(); navigator.vibrate && navigator.vibrate(15); }, 380);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  });
}
function hover(x, y) {
  D.ghost.style.display = "none";
  const under = document.elementFromPoint(x, y);
  D.ghost.style.display = "";
  let z = under && under.closest("[data-dz]");
  while (z && !(z._dz.accept ? z._dz.accept(D.payload, z) : true)) z = z.parentElement && z.parentElement.closest("[data-dz]");
  if (z !== D.zone) {
    if (D.zone) D.zone.classList.remove("dz-over");
    if (D.ph) { D.ph.remove(); D.ph = null; }
    D.zone = z || null;
    if (z && !z._dz.list) z.classList.add("dz-over");
  }
  if (z && z._dz.list) {
    const kids = [...z.children].filter(c => c.matches(z._dz.item || "[data-k]") && c !== D.ph);
    let i = kids.length;
    for (let k = 0; k < kids.length; k++) { const r = kids[k].getBoundingClientRect(); if (y < r.top + r.height / 2) { i = k; break; } }
    if (!D.ph) { D.ph = document.createElement("div"); D.ph.className = "dz-ph"; }
    const ref = kids[i] || null;
    if (ref) z.insertBefore(D.ph, ref); else if (z._dz.end) z.insertBefore(D.ph, z.querySelector(z._dz.end)); else z.appendChild(D.ph);
    // index « logique » sans compter l'élément déplacé lui-même
    D.index = i;
  } else D.index = -1;
}
function clear() {
  if (!D) return;
  D.ghost.remove(); D.src.classList.remove("dragging"); document.body.classList.remove("is-dragging");
  if (D.zone) D.zone.classList.remove("dz-over");
  if (D.ph) D.ph.remove();
  D = null;
}
function autoscroll(ev) {
  const sc = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".scrolly");
  if (sc) { const r = sc.getBoundingClientRect(); if (ev.clientY < r.top + 40) sc.scrollTop -= 12; else if (ev.clientY > r.bottom - 40) sc.scrollTop += 12; }
  if (ev.clientY < 60) scrollBy(0, -14); else if (ev.clientY > innerHeight - 80) scrollBy(0, 14);
}
// Glisser des fichiers depuis l'ordinateur
export function fileDrop(zone, onFiles, { cls = "over" } = {}) {
  zone.addEventListener("dragover", e => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); e.stopPropagation(); zone.classList.add(cls); } });
  zone.addEventListener("dragleave", e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove(cls); });
  zone.addEventListener("drop", e => { const f = [...e.dataTransfer.files]; zone.classList.remove(cls); if (!f.length) return; e.preventDefault(); e.stopPropagation(); onFiles(f, e); });
}

/* ---------- changement de mot de passe (avec confirmation) ---------- */
export function passwordBox(el, onSave) {
  el.innerHTML = `<b>Changer mon mot de passe</b>
    <label class="f">Nouveau mot de passe</label>
    <div class="pwrow"><input type="password" class="pw1" autocomplete="new-password" placeholder="6 caractères minimum"><button type="button" class="ib pweye" title="Afficher / masquer">👁️</button></div>
    <label class="f">Confirmer le mot de passe</label>
    <div class="pwrow"><input type="password" class="pw2" autocomplete="new-password" placeholder="Retapez le même mot de passe"></div>
    <div class="pwhint mute"></div>
    <p><button class="btn" disabled>Changer le mot de passe</button></p>`;
  const a = el.querySelector(".pw1"), b = el.querySelector(".pw2"), hint = el.querySelector(".pwhint"), btn = el.querySelector(".btn");
  const check = () => {
    const ok1 = a.value.length >= 6, ok2 = b.value.length > 0 && a.value === b.value;
    hint.innerHTML = !a.value ? "" : !ok1 ? "✗ Trop court : 6 caractères minimum." : !b.value ? "Retapez-le dans le second champ." : ok2 ? '<span style="color:var(--ok)">✓ Les deux mots de passe sont identiques.</span>' : '<span style="color:var(--r)">✗ Les deux mots de passe sont différents.</span>';
    btn.disabled = !(ok1 && ok2);
  };
  a.oninput = b.oninput = check;
  b.onkeydown = e => { if (e.key === "Enter" && !btn.disabled) btn.click(); };
  el.querySelector(".pweye").onclick = () => { const t = a.type === "password" ? "text" : "password"; a.type = b.type = t; };
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = "Enregistrement…";
    const ok = await onSave(a.value);
    btn.textContent = "Changer le mot de passe";
    if (ok) { a.value = b.value = ""; hint.innerHTML = '<span style="color:var(--ok)">✓ Mot de passe changé.</span>'; } else check();
  };
}

/* ---------- carte « Installer l'application » ---------- */
export function installCard(el) {
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (standalone) { el.innerHTML = `<b>📲 Application installée</b><p class="mute" style="margin:4px 0 0">Vous utilisez Paso a paso comme une application. ✓</p>`; return; }
  const draw = () => {
    const p = window.__installPrompt;
    el.innerHTML = `<b>📲 Installer l'application</b><p class="mute" style="margin:4px 0 8px">Une icône « Paso a paso » sur votre écran d'accueil, ouverture en plein écran, et les leçons déjà ouvertes restent lisibles sans connexion.</p>
      ${p ? `<button class="btn" data-inst>Installer sur cet appareil</button>`
        : ios ? `<ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7"><li>Ouvrez cette page dans <b>Safari</b>.</li><li>Touchez le bouton <b>Partager</b> (le carré avec une flèche vers le haut).</li><li>Choisissez <b>« Sur l'écran d'accueil »</b>, puis <b>Ajouter</b>.</li></ol>`
        : `<p style="margin:0;font-size:14px">Dans le menu de votre navigateur (⋮ ou ⋯), choisissez <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>.</p>`}`;
    const b = el.querySelector("[data-inst]");
    if (b) b.onclick = async () => { p.prompt(); const r = await p.userChoice.catch(() => null); window.__installPrompt = null; if (r && r.outcome === "accepted") el.innerHTML = `<b>📲 Application installée</b><p class="mute" style="margin:4px 0 0">Retrouvez l'icône sur votre écran d'accueil. ✓</p>`; else draw(); };
  };
  draw();
  window.addEventListener("beforeinstallprompt", () => setTimeout(draw), { once: true });
}
