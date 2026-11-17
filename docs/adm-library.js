// Bibliothèque de supports de cours : un explorateur de fichiers façon Windows.
import { $, $$, esc, ui, fmtDate, cleanLesson } from "./core.js";
import { modal, confirmDlg, promptDlg, menu, toast, draggable, dropZone, fileDrop } from "./ui.js";
import { S, api, fail, clone, subFolders, folderFiles, descendants, folderPath, isInside, folderById, fileById, syncAccess, pickStudents, addItemsToPlan, removeItemsFromPlan, savePlan, studentById, sName, initials, saveOrder } from "./adm-state.js";
import { uploadFile, deleteFile, previewFile, downloadFile, fileKind, kindIcon, kindName, fmtSize, fileBlob, fileToHtml, MAX_FILE } from "./files.js";

const E = { cur: null, sel: new Set(), last: null, view: "grid", sort: "name", q: "", open: new Set([null]) };
try { E.view = localStorage.getItem("paso_libview") || "grid"; } catch (e) {}
const coarse = () => matchMedia("(pointer:coarse)").matches;
const K = (k, id) => k + ":" + id;
const obj = key => key[0] === "d" ? folderById(key.slice(2)) : fileById(key.slice(2));

export function libraryView(folder) {
  if (folder !== undefined) E.cur = folder;
  if (E.cur && !folderById(E.cur)) E.cur = null;
  ui.setTitle("🗂️ Bibliothèque");
  ui.m.innerHTML = `<div class="explorer" id="ex">
    <aside class="tree scrolly" id="tree"></aside>
    <section class="pane">
      <div class="exp-tools">
        <button class="ib" id="up" title="Dossier parent (Retour arrière)">⬆</button>
        <nav class="crumbs" id="crumbs"></nav>
        <input type="search" id="q" placeholder="🔎 Rechercher" value="${esc(E.q)}">
      </div>
      <div class="exp-actions">
        <button class="btn small" id="nf">📁 Nouveau dossier</button>
        <button class="btn small" id="upl">⬆️ Importer des fichiers</button>
        <span class="sep"></span>
        <button class="btn ghost small" data-sel="assign">👥 Attribuer</button>
        <button class="btn ghost small" data-sel="move">↪️ Déplacer</button>
        <button class="btn ghost small" data-sel="rename">✏️ Renommer</button>
        <button class="btn ghost small" data-sel="del">🗑️ Supprimer</button>
        <span style="flex:1"></span>
        <select id="sort" title="Trier"><option value="name">Nom</option><option value="date">Date</option><option value="size">Taille</option><option value="type">Type</option></select>
        <button class="ib" id="vw" title="Changer l'affichage">${E.view === "grid" ? "☰" : "▦"}</button>
      </div>
      <div class="exp-content scrolly" id="content" tabindex="0"></div>
      <div class="exp-status" id="status"></div>
      <input type="file" id="fin" multiple hidden>
    </section>
    <aside class="details scrolly" id="det"></aside>
  </div>
  <div id="uploads"></div>`;
  $("#sort").value = E.sort;
  $("#up").onclick = () => { if (E.cur) go(folderById(E.cur)?.parent || null); };
  $("#q").oninput = e => { E.q = e.target.value; drawContent(); };
  $("#sort").onchange = e => { E.sort = e.target.value; drawContent(); };
  $("#vw").onclick = () => { E.view = E.view === "grid" ? "list" : "grid"; try { localStorage.setItem("paso_libview", E.view); } catch (e) {} libraryView(); };
  $("#nf").onclick = () => newFolder(E.cur);
  $("#upl").onclick = () => $("#fin").click();
  $("#fin").onchange = e => { const f = [...e.target.files]; e.target.value = ""; if (f.length) upload(f, E.cur); };
  $$("[data-sel]").forEach(b => b.onclick = () => act(b.dataset.sel));
  const content = $("#content");
  content.addEventListener("click", e => { if (!e.target.closest(".it")) { E.sel.clear(); drawSel(); } });
  content.addEventListener("contextmenu", e => { if (e.target.closest(".it")) return; e.preventDefault(); E.sel.clear(); drawSel(); menu(e.clientX, e.clientY, [{ icon: "📁", label: "Nouveau dossier", act: () => newFolder(E.cur) }, { icon: "⬆️", label: "Importer des fichiers…", act: () => $("#fin").click() }, "-", { icon: "☑️", label: "Tout sélectionner", hint: "Ctrl+A", act: selectAll }]); });
  content.addEventListener("keydown", keys);
  fileDrop(content, f => upload(f, E.cur), { cls: "drop-files" });
  // glisser des éléments (déplacement)
  draggable(content, {
    selector: ".it", payload: el => { const k = el.dataset.key; if (!E.sel.has(k)) { E.sel = new Set([k]); drawSel(); } return { kind: "lib", keys: [...E.sel] }; },
    label: p => p.keys.length > 1 ? `📦 ${p.keys.length} éléments` : `${iconOf(p.keys[0])} ${esc(obj(p.keys[0])?.name || "")}`,
  });
  drawTree(); drawCrumbs(); drawContent();
  content.focus({ preventScroll: true });
}
function go(fid) { E.cur = fid; E.sel.clear(); E.q = ""; const q = $("#q"); if (q) q.value = ""; folderPath(fid).forEach(f => E.open.add(f.id)); drawTree(); drawCrumbs(); drawContent(); }
const iconOf = key => key[0] === "d" ? "📁" : kindIcon(fileKind(obj(key)?.name, obj(key)?.type));

/* ---------- arborescence à gauche ---------- */
function drawTree() {
  const node = (f, depth) => {
    const id = f ? f.id : null, kids = subFolders(id), open = E.open.has(id);
    return `<div class="tn ${E.cur === id ? "on" : ""}" data-fid="${id ?? ""}" style="padding-left:${6 + depth * 14}px">
      <span class="tw">${kids.length ? (open ? "▾" : "▸") : ""}</span>${f ? "📁" : "🗂️"} <span class="tl">${esc(f ? f.name : "Bibliothèque")}</span>${f?.students?.length ? `<span class="cnt" title="${f.students.length} élève(s)">👥${f.students.length}</span>` : ""}</div>
      ${open ? kids.map(k => node(k, depth + 1)).join("") : ""}`;
  };
  const t = $("#tree"); t.innerHTML = node(null, 0);
  $$(".tn", t).forEach(n => {
    const id = n.dataset.fid || null;
    n.onclick = e => { if (e.target.closest(".tw") && subFolders(id).length) { E.open.has(id) ? E.open.delete(id) : E.open.add(id); drawTree(); return; } go(id); };
    n.oncontextmenu = e => { e.preventDefault(); if (id) itemMenu(e, K("d", id)); else menu(e.clientX, e.clientY, [{ icon: "📁", label: "Nouveau dossier ici", act: () => newFolder(null) }]); };
    folderTarget(n, id);
  });
}
function drawCrumbs() {
  const c = $("#crumbs");
  c.innerHTML = `<span class="cr" data-fid="">🗂️ Bibliothèque</span>` + folderPath(E.cur).map(f => `<span class="crs">›</span><span class="cr" data-fid="${f.id}">${esc(f.name)}</span>`).join("");
  $$(".cr", c).forEach(n => { const id = n.dataset.fid || null; n.onclick = () => go(id); folderTarget(n, id); });
  $("#up").disabled = !E.cur;
}
// un dossier peut recevoir des éléments glissés (déplacement) et des fichiers de l'ordinateur (import)
function folderTarget(el, fid) {
  dropZone(el, {
    accept: p => p.kind === "lib" && p.keys.every(k => k !== K("d", fid) && !(k[0] === "d" && fid && isInside(fid, k.slice(2))) && (obj(k)?.[k[0] === "d" ? "parent" : "folder"] || null) !== fid),
    drop: p => move(p.keys, fid),
  });
  fileDrop(el, f => upload(f, fid), { cls: "dz-over" });
}

/* ---------- contenu du dossier ---------- */
function items() {
  let list;
  if (E.q.trim()) {
    const q = E.q.toLowerCase();
    list = [...S.folders.map(f => ({ key: K("d", f.id), o: f })), ...S.files.map(f => ({ key: K("f", f.id), o: f }))].filter(x => x.o.name.toLowerCase().includes(q));
  } else list = [...subFolders(E.cur).map(f => ({ key: K("d", f.id), o: f })), ...folderFiles(E.cur).map(f => ({ key: K("f", f.id), o: f }))];
  const by = { name: (a, b) => a.o.name.localeCompare(b.o.name, "fr", { numeric: true }), date: (a, b) => (b.o.updatedAt || b.o.createdAt || 0) - (a.o.updatedAt || a.o.createdAt || 0), size: (a, b) => (b.o.size || 0) - (a.o.size || 0), type: (a, b) => fileKind(a.o.name).localeCompare(fileKind(b.o.name)) }[E.sort];
  return [...list.filter(x => x.key[0] === "d").sort(by), ...list.filter(x => x.key[0] === "f").sort(by)];
}
function drawContent() {
  const L = items(), c = $("#content");
  if (!L.length) {
    c.innerHTML = `<div class="empty">${E.q ? "Aucun résultat." : `<div class="big">📂</div><b>Ce dossier est vide</b><p class="mute">Glissez ici des fichiers depuis votre ordinateur<br>(PDF, Word, images, audio, vidéo… ${fmtSize(MAX_FILE)} max par fichier)</p><button class="btn small" id="e_up">⬆️ Importer des fichiers</button> <button class="btn ghost small" id="e_nf">📁 Nouveau dossier</button>`}</div>`;
    const u = $("#e_up"); if (u) { u.onclick = () => $("#fin").click(); $("#e_nf").onclick = () => newFolder(E.cur); }
  } else if (E.view === "grid") {
    c.innerHTML = `<div class="grid-items">${L.map(({ key, o }) => `<div class="it tile" data-key="${key}" title="${esc(o.name)}">
      <input type="checkbox" class="ck2" tabindex="-1"><div class="ic">${iconOf(key)}</div><div class="nm">${esc(o.name)}</div>
      <div class="meta">${key[0] === "d" ? `${subFolders(o.id).length + folderFiles(o.id).length} élément(s)` : fmtSize(o.size)}${o.students?.length ? ` · 👥${o.students.length}` : ""}</div>
      ${E.q ? `<div class="meta">${esc(folderPath(key[0] === "d" ? o.parent : o.folder).map(f => f.name).join(" › ") || "Bibliothèque")}</div>` : ""}</div>`).join("")}</div>`;
  } else {
    c.innerHTML = `<table class="tlist"><thead><tr><th style="width:28px"></th><th>Nom</th><th>Type</th><th>Taille</th><th>Modifié</th><th>Élèves</th></tr></thead><tbody>${L.map(({ key, o }) => `<tr class="it" data-key="${key}"><td><input type="checkbox" class="ck2" tabindex="-1"></td><td><span class="lic">${iconOf(key)}</span> ${esc(o.name)}${E.q ? `<br><small class="mute">${esc(folderPath(key[0] === "d" ? o.parent : o.folder).map(f => f.name).join(" › ") || "Bibliothèque")}</small>` : ""}</td><td>${key[0] === "d" ? "Dossier" : kindName(fileKind(o.name, o.type))}</td><td>${key[0] === "d" ? "" : fmtSize(o.size)}</td><td>${fmtDate(o.updatedAt || o.createdAt)}</td><td>${o.students?.length ? `👥 ${o.students.length}` : ""}</td></tr>`).join("")}</tbody></table>`;
  }
  $$(".it", c).forEach(el => {
    const key = el.dataset.key;
    el.onclick = e => {
      if (e.target.classList.contains("ck2")) { toggle(key); return; }
      if (coarse() && !e.ctrlKey && !e.shiftKey && !E.sel.size) return open(key);
      if (e.shiftKey && E.last) { const keys = L.map(x => x.key), a = keys.indexOf(E.last), b = keys.indexOf(key); E.sel = new Set(keys.slice(Math.min(a, b), Math.max(a, b) + 1)); }
      else if (e.ctrlKey || e.metaKey || coarse()) toggle(key, true);
      else E.sel = new Set([key]);
      E.last = key; drawSel();
    };
    el.ondblclick = () => open(key);
    el.oncontextmenu = e => { e.preventDefault(); if (!E.sel.has(key)) { E.sel = new Set([key]); E.last = key; drawSel(); } itemMenu(e, key); };
    if (key[0] === "d") folderTarget(el, key.slice(2));
  });
  drawSel();
}
function toggle(key, noDraw) { E.sel.has(key) ? E.sel.delete(key) : E.sel.add(key); E.last = key; if (!noDraw) drawSel(); }
function selectAll() { E.sel = new Set(items().map(x => x.key)); drawSel(); }
function drawSel() {
  $$("#content .it").forEach(el => { const on = E.sel.has(el.dataset.key); el.classList.toggle("sel", on); const c = el.querySelector(".ck2"); if (c) c.checked = on; });
  const n = E.sel.size, L = items();
  $("#status").textContent = `${L.length} élément${L.length > 1 ? "s" : ""}${n ? ` · ${n} sélectionné${n > 1 ? "s" : ""}` : ""}`;
  $$("[data-sel]").forEach(b => b.disabled = !n || (b.dataset.sel === "rename" && n !== 1));
  drawDetails();
}

/* ---------- panneau de détails ---------- */
function drawDetails() {
  const d = $("#det"); if (!d) return;
  const keys = [...E.sel];
  if (!keys.length) {
    const f = E.cur ? folderById(E.cur) : null, nf = descendants(E.cur).length, nfi = S.files.filter(x => !E.cur || x.folder === E.cur || descendants(E.cur).some(dd => dd.id === x.folder)).length;
    const total = S.files.reduce((a, b) => a + (b.size || 0), 0);
    d.innerHTML = `<div class="dt-ic">${f ? "📁" : "🗂️"}</div><h3>${esc(f ? f.name : "Bibliothèque")}</h3>
      <p class="mute">${nf} dossier(s) · ${nfi} fichier(s)</p>${f ? accessHtml(K("d", f.id)) : `<p class="mute">Espace utilisé : ${fmtSize(total)} sur 1 Go gratuit.</p>`}
      <div class="tip">💡 <b>Astuces</b><br>• Glissez des fichiers depuis votre ordinateur pour les importer.<br>• Glissez des éléments sur un dossier (à gauche ou dans la liste) pour les déplacer.<br>• Clic droit pour toutes les actions.<br>• Ctrl/⌘ + clic ou Maj + clic pour sélectionner plusieurs éléments.</div>`;
    return;
  }
  if (keys.length > 1) {
    const size = keys.reduce((a, k) => a + (obj(k)?.size || 0), 0);
    d.innerHTML = `<div class="dt-ic">📦</div><h3>${keys.length} éléments</h3><p class="mute">${fmtSize(size)}</p>
      <div class="dt-acts"><button class="btn small" data-a="assign">👥 Attribuer aux élèves</button><button class="btn ghost small" data-a="move">↪️ Déplacer</button><button class="btn ghost small" data-a="del">🗑️ Supprimer</button></div>`;
  } else {
    const k = keys[0], o = obj(k); if (!o) return;
    const isF = k[0] === "f", kind = isF ? fileKind(o.name, o.type) : "folder";
    d.innerHTML = `<div class="dt-ic">${iconOf(k)}</div><h3 style="word-break:break-word">${esc(o.name)}</h3>
      <p class="mute">${kindName(kind)}${isF ? " · " + fmtSize(o.size) : ` · ${subFolders(o.id).length + folderFiles(o.id).length} élément(s)`}<br>Ajouté le ${fmtDate(o.createdAt)}<br>📍 ${esc(folderPath(isF ? o.folder : o.parent).map(f => f.name).join(" › ") || "Bibliothèque")}</p>
      <div class="dt-acts"><button class="btn small" data-a="open">${isF ? "👁️ Ouvrir" : "📂 Ouvrir"}</button>${isF ? `<button class="btn ghost small" data-a="dl">⬇️ Télécharger</button>` : ""}<button class="btn ghost small" data-a="assign">👥 Attribuer</button><button class="btn ghost small" data-a="rename">✏️ Renommer</button><button class="btn ghost small" data-a="move">↪️ Déplacer</button>${isF && /\.(docx|pdf)$/i.test(o.name) ? `<button class="btn ghost small" data-a="lesson">🎓 Créer une leçon</button>` : ""}<button class="btn ghost small" data-a="del">🗑️ Supprimer</button></div>
      ${accessHtml(k)}`;
  }
  $$("[data-a]", d).forEach(b => b.onclick = () => act(b.dataset.a));
  $$("[data-stu]", d).forEach(b => b.onclick = () => S.C.go("student", b.dataset.stu));
}
function accessHtml(key) {
  const o = obj(key); if (!o) return "";
  const direct = S.students.filter(s => S.plans[s.id]?.chapters.some(c => c.items.some(i => K(i.k, i.id) === key)));
  const via = (o.students || []).filter(u => !direct.some(s => s.id === u)).map(studentById).filter(Boolean);
  return `<div class="acc"><b>👥 Élèves qui y ont accès</b>
    ${direct.length || via.length ? "" : `<p class="mute">Personne pour l'instant.</p>`}
    ${direct.map(s => `<span class="chip2" data-stu="${s.id}" title="Ouvrir la fiche"><span class="av sm">${esc(initials(s))}</span>${esc(sName(s))}</span>`).join("")}
    ${via.length ? `<p class="mute" style="margin:8px 0 4px">Via un dossier attribué :</p>${via.map(s => `<span class="chip2 soft" data-stu="${s.id}"><span class="av sm">${esc(initials(s))}</span>${esc(sName(s))}</span>`).join("")}` : ""}
    <p><button class="btn ghost small" data-a="assign">Modifier…</button></p></div>`;
}

/* ---------- actions ---------- */
function itemMenu(e, key) {
  const many = E.sel.size > 1, o = obj(key), isF = key[0] === "f";
  menu(e.clientX, e.clientY, [
    ...(many ? [] : [{ icon: isF ? "👁️" : "📂", label: "Ouvrir", hint: "Entrée", act: () => open(key) }]),
    ...(isF && !many ? [{ icon: "⬇️", label: "Télécharger", act: () => downloadFile(api(), o) }] : []),
    { icon: "👥", label: "Attribuer aux élèves…", act: () => act("assign") },
    "-",
    ...(many ? [] : [{ icon: "✏️", label: "Renommer", hint: "F2", act: () => act("rename") }]),
    { icon: "↪️", label: "Déplacer vers…", act: () => act("move") },
    ...(!many && !isF ? [{ icon: "📁", label: "Nouveau sous-dossier", act: () => newFolder(o.id) }] : []),
    ...(!many && isF && /\.(docx|pdf)$/i.test(o.name) ? [{ icon: "🎓", label: "Créer une leçon depuis ce fichier", act: () => act("lesson") }] : []),
    "-",
    { icon: "🗑️", label: "Supprimer", hint: "Suppr", danger: true, act: () => act("del") },
  ]);
}
function open(key) { if (key[0] === "d") go(key.slice(2)); else previewFile(api(), obj(key)); }
function keys(e) {
  if (e.target.closest("input,textarea")) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") { e.preventDefault(); selectAll(); }
  else if (e.key === "Delete" && E.sel.size) act("del");
  else if (e.key === "F2" && E.sel.size === 1) act("rename");
  else if (e.key === "Enter" && E.sel.size === 1) open([...E.sel][0]);
  else if (e.key === "Backspace" && E.cur) go(folderById(E.cur)?.parent || null);
  else if (e.key === "Escape") { E.sel.clear(); drawSel(); }
}
async function act(a) {
  const keys = [...E.sel]; if (!keys.length) return;
  try {
    if (a === "open") return open(keys[0]);
    if (a === "dl") return downloadFile(api(), obj(keys[0]));
    if (a === "rename") return rename(keys[0]);
    if (a === "move") return moveDlg(keys);
    if (a === "del") return remove(keys);
    if (a === "assign") return assign(keys);
    if (a === "lesson") return toLesson(obj(keys[0]));
  } catch (e) { fail(e); }
}
async function newFolder(parent) {
  const name = await promptDlg("Nouveau dossier", "Nouveau dossier", { ok: "Créer" }); if (!name) return;
  try {
    const id = api().newId("folders");
    const inherited = parent ? [...(folderById(parent)?.students || [])] : [];
    const f = { name, parent: parent || null, students: inherited, createdAt: Date.now(), updatedAt: Date.now() };
    await api().set("folders/" + id, f, false); S.folders.push({ id, ...f });
    if (parent) E.open.add(parent);
    E.sel = new Set([K("d", id)]); drawTree(); drawContent(); toast("Dossier créé");
  } catch (e) { fail(e); }
}
async function rename(key) {
  const o = obj(key), isF = key[0] === "f";
  let base = o.name, ext = "";
  if (isF && /\.[^.]{1,5}$/.test(o.name)) { ext = o.name.match(/\.[^.]{1,5}$/)[0]; base = o.name.slice(0, -ext.length); }
  const n = await promptDlg("Renommer", base, { ok: "Renommer", label: isF && ext ? `Extension conservée : ${ext}` : "" }); if (!n || n + ext === o.name) return;
  o.name = n + ext; o.updatedAt = Date.now();
  await api().set((isF ? "files/" : "folders/") + o.id, { name: o.name, updatedAt: o.updatedAt });
  drawTree(); drawCrumbs(); drawContent(); toast("Renommé ✓");
}
async function move(keys, dest) {
  for (const k of keys) {
    const o = obj(k); if (!o) continue;
    if (k[0] === "d") { if (k.slice(2) === dest || (dest && isInside(dest, o.id))) continue; o.parent = dest || null; await api().set("folders/" + o.id, { parent: o.parent, updatedAt: Date.now() }); }
    else { o.folder = dest || null; await api().set("files/" + o.id, { folder: o.folder, updatedAt: Date.now() }); }
  }
  await syncAccess(); // les accès hérités des dossiers suivent le déplacement
  E.sel.clear(); if (dest) E.open.add(dest);
  drawTree(); drawContent();
  toast(`${keys.length} élément(s) déplacé(s) vers « ${dest ? folderById(dest).name : "Bibliothèque"} »`);
}
function moveDlg(keys) {
  const banned = new Set(keys.filter(k => k[0] === "d").flatMap(k => [k.slice(2), ...descendants(k.slice(2)).map(f => f.id)]));
  let target = E.cur;
  const body = document.createElement("div");
  const draw = () => {
    const node = (f, depth) => { const id = f ? f.id : null; if (id && banned.has(id)) return ""; return `<div class="tn ${target === id ? "on" : ""}" data-fid="${id ?? ""}" style="padding-left:${6 + depth * 16}px">${f ? "📁" : "🗂️"} ${esc(f ? f.name : "Bibliothèque")}</div>${subFolders(id).map(k => node(k, depth + 1)).join("")}`; };
    body.innerHTML = `<p class="mute">Choisissez le dossier de destination :</p><div class="tree" style="max-height:50vh;overflow:auto;border:1px solid var(--line);border-radius:10px">${node(null, 0)}</div>`;
    $$(".tn", body).forEach(n => n.onclick = () => { target = n.dataset.fid || null; draw(); });
  };
  draw();
  modal({ title: `Déplacer ${keys.length} élément(s)`, body, buttons: [{ label: "Annuler", value: null }, { label: "Déplacer ici", primary: true, act: () => { move(keys, target).catch(fail); } }] });
}
async function remove(keys) {
  const folders = keys.filter(k => k[0] === "d").map(k => obj(k)).filter(Boolean);
  const allF = new Set(folders.flatMap(f => [f, ...descendants(f.id)]));
  const files = new Set([...keys.filter(k => k[0] === "f").map(obj).filter(Boolean), ...[...allF].flatMap(f => folderFiles(f.id))]);
  const users = new Set([...files, ...allF].flatMap(o => o.students || []));
  const ok = await confirmDlg(`Supprimer définitivement ${files.size} fichier(s)${allF.size ? ` et ${allF.size} dossier(s)` : ""} ?${users.size ? `<br><br>⚠️ ${users.size} élève(s) n'y auront plus accès.` : ""}`, { ok: "Supprimer", danger: true, title: "Supprimer" });
  if (!ok) return;
  toast("Suppression…", 1500);
  for (const f of files) await deleteFile(api(), f);
  for (const d of allF) await api().del("folders/" + d.id);
  const gone = new Set([...[...files].map(f => K("f", f.id)), ...[...allF].map(d => K("d", d.id))]);
  S.files = S.files.filter(f => !files.has(f)); S.folders = S.folders.filter(d => !allF.has(d));
  // retirer des parcours
  for (const s of S.students) { const p = clone(S.plans[s.id]); if (p && removeItemsFromPlan(p, [...gone])) await savePlan(s.id, p); }
  for (const t of S.templates) { const n = t.chapters.reduce((a, c) => a + c.items.length, 0); t.chapters.forEach(c => c.items = c.items.filter(i => !gone.has(K(i.k, i.id)))); if (t.chapters.reduce((a, c) => a + c.items.length, 0) !== n) await api().set("templates/" + t.id, { chapters: t.chapters }); }
  if (E.cur && !folderById(E.cur)) E.cur = null;
  E.sel.clear(); drawTree(); drawCrumbs(); drawContent(); toast("Supprimé ✓");
}
async function assign(keys) {
  const has = s => keys.every(k => S.plans[s.id]?.chapters.some(c => c.items.some(i => K(i.k, i.id) === k)));
  const pre = S.students.filter(has).map(s => s.id);
  const names = keys.length === 1 ? `« ${esc(obj(keys[0]).name)} »` : `${keys.length} éléments`;
  const chosen = await pickStudents({ title: "👥 Attribuer " + (keys.length === 1 ? "ce support" : "ces supports"), intro: `Cochez les élèves qui recevront ${names}. Ils apparaîtront dans leur parcours (chapitre « 📎 Documents » si nouveau) : vous pourrez ensuite les ranger dans le chapitre de votre choix.`, selected: pre, ok: "Enregistrer" });
  if (!chosen) return;
  const items = keys.map(k => ({ k: k[0], id: k.slice(2) }));
  let changed = 0;
  for (const s of S.students) {
    const p = clone(S.plans[s.id] || { mode: "manual", chapters: [], state: {}, notes: {}, extra: {}, message: "" });
    const want = chosen.includes(s.id), had = pre.includes(s.id);
    let n = 0;
    if (want) n = addItemsToPlan(p, items);
    else if (had) n = removeItemsFromPlan(p, keys);
    if (n) { await api().replace("plans/" + s.id, p); S.plans[s.id] = p; changed++; }
  }
  await syncAccess();
  drawContent(); drawTree();
  toast(changed ? `Attribution mise à jour pour ${changed} élève(s) ✓` : "Aucun changement");
}
async function toLesson(f) {
  toast("Conversion en leçon…", 2000);
  const blob = await fileBlob(api(), f);
  const html = await fileToHtml(new File([blob], f.name, { type: f.type }));
  const id = api().newId("lessons");
  const l = cleanLesson({ title: f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), course: html, published: false });
  await api().set("lessons/" + id, { ...l, createdAt: Date.now(), updatedAt: Date.now(), source: f.name }, false);
  S.lessons.push({ id, ...l, createdAt: Date.now() }); await saveOrder();
  toast("Leçon créée en brouillon ✓");
  S.C.go("lesson", id);
}

/* ---------- import de fichiers ---------- */
async function upload(files, folder) {
  const box = $("#uploads") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "uploads" }));
  box.className = "uploads";
  const students = folder ? [...(folderById(folder)?.students || [])] : [];
  let ok = 0;
  for (const f of files) {
    const row = document.createElement("div"); row.className = "upl";
    row.innerHTML = `<span>${kindIcon(fileKind(f.name, f.type))} ${esc(f.name)}</span><div class="minibar"><i style="width:0"></i></div>`;
    box.appendChild(row);
    try {
      const doc = await uploadFile(api(), f, { folder, students }, p => row.querySelector("i").style.width = Math.round(p * 100) + "%");
      S.files.push(doc); ok++;
      row.classList.add("done");
      if (!E.q && E.cur === folder) drawContent();
    } catch (e) { row.classList.add("err"); row.querySelector(".minibar").outerHTML = `<small>${esc(e.message || "Erreur")}</small>`; }
    setTimeout(() => row.classList.contains("err") || row.remove(), 2500);
  }
  drawTree(); drawContent();
  if (ok) toast(`${ok} fichier(s) importé(s)${students.length ? ` · accessibles aux ${students.length} élève(s) de ce dossier` : ""}`, 3500);
}
