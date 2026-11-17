// Leçons interactives : liste, éditeur complet, import Word/PDF, exercices.
import { $, $$, esc, ui, linkify, cleanLesson, runQuiz, autoVocabEx, fmtDate, typeName, ikey } from "./core.js";
import { modal, confirmDlg, promptDlg, choiceDlg, menu, toast, draggable, dropZone, fileDrop } from "./ui.js";
import { S, api, fail, clone, saveOrder, lessonById, savePlan, addItemsToPlan, removeItemsFromPlan, planHas, sName, initials } from "./adm-state.js";
import { SEED } from "./seed.js";
import { fileToHtml, compressImage, cleanHtml } from "./files.js";

const sizeOf = o => new Blob([JSON.stringify(o)]).size;
const sw = (attrs, checked, label) => `<label class="swl"><span class="sw"><input type="checkbox" ${attrs} ${checked ? "checked" : ""}><span></span></span>${label || ""}</label>`;
// Réordonner une liste par glisser-déposer (poignée ⠿)
export function sortableList(box, itemSel, onDone) {
  draggable(box, { selector: itemSel, handle: ".handle", payload: el => el.parentElement === box ? { kind: "sort", box, el } : null, label: (p, el) => esc((el.querySelector("b,input")?.value || el.innerText).split("\n")[0].slice(0, 50)) });
  dropZone(box, { list: true, item: itemSel, accept: p => p.kind === "sort" && p.box === box, drop: (p, i) => {
    const kids = [...box.children].filter(c => c.matches(itemSel)), ref = kids[i] || null;
    if (ref !== p.el) box.insertBefore(p.el, ref);
    onDone([...box.children].filter(c => c.matches(itemSel)).map(c => c.dataset.id));
  } });
}
const usage = id => S.students.filter(s => planHas(s.id, "l:" + id));

/* =================== LISTE =================== */
export function lessonsView() {
  ui.setTitle("🎓 Leçons");
  let h = "";
  if (!S.lessons.length) h += `<div class="card hero"><h2>Bienvenue 👋</h2><p>Votre bibliothèque de leçons est vide. Installez les 14 leçons d'espagnol préparées (tout reste modifiable), ou partez de zéro.</p><button class="btn" style="background:#fff;color:var(--g)" id="seed">Installer les 14 leçons de départ</button></div>`;
  h += `<div class="dropzone" id="dz"><b>📥 Glissez ici vos cours Word (.docx) ou PDF</b><br><span class="mute">ou cliquez pour choisir. Chaque fichier devient une leçon en brouillon, que vous retouchez ensuite.</span><input type="file" id="fi" accept=".docx,.pdf,.txt,.html,.htm" multiple hidden></div>
  <div class="row tight" style="margin-bottom:12px;align-items:center"><button class="btn" id="new">+ Nouvelle leçon</button>${S.lessons.length && SEED.some(s => !lessonById(s.id)) ? `<button class="btn ghost" id="seed2">Ajouter les leçons de départ manquantes</button>` : ""}<input type="search" id="lq" placeholder="🔎 Rechercher une leçon" style="max-width:260px;margin-left:auto"></div>
  <p class="mute">Glissez ⠿ pour ranger vos leçons. L'ordre des leçons <b>dans le parcours de chaque élève</b> se règle dans sa fiche (onglet 👥 Élèves) ou dans un parcours type.</p>
  <div class="list" id="ll">${S.lessons.map(l => { const u = usage(l.id).length; return `<div class="item" data-id="${l.id}"><span class="handle" title="Glisser">⠿</span><span style="font-size:22px">${esc(l.emoji)}</span>
    <div class="t"><b>${esc(l.title)}</b><span class="tag ${l.type}">${typeName(l.type)}</span> ${l.published ? "" : `<span class="tag D">Brouillon</span>`} <span class="mute">${l.vocab.length} mots · ${l.ex.length} exercices · ${u ? `dans le parcours de ${u} élève${u > 1 ? "s" : ""}` : "aucun élève"}</span></div>
    <button class="btn small" data-ed="${l.id}">✏️ Modifier</button><button class="ib" data-more="${l.id}" title="Plus d'actions">⋯</button></div>`; }).join("")}</div>`;
  ui.m.innerHTML = h;
  const s = $("#seed"), s2 = $("#seed2");
  if (s) s.onclick = () => installSeed(s);
  if (s2) s2.onclick = () => installSeed(s2, true);
  $("#new").onclick = () => editLesson(null);
  $("#lq").oninput = e => { const q = e.target.value.toLowerCase(); $$("#ll .item").forEach(i => i.style.display = i.textContent.toLowerCase().includes(q) ? "" : "none"); };
  $$("[data-ed]").forEach(b => b.onclick = () => editLesson(b.dataset.ed));
  $$("#ll .item").forEach(i => { i.ondblclick = e => { if (!e.target.closest("button")) editLesson(i.dataset.id); }; i.oncontextmenu = e => { e.preventDefault(); lessonMenu(i.dataset.id, e.clientX, e.clientY); }; });
  $$("[data-more]").forEach(b => b.onclick = e => { const r = b.getBoundingClientRect(); lessonMenu(b.dataset.more, r.right - 220, r.bottom + 4); });
  sortableList($("#ll"), ".item", async ids => { S.lessons.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)); try { await saveOrder(); toast("Ordre enregistré"); } catch (e) { fail(e); } });
  const dz = $("#dz"), fi = $("#fi");
  dz.onclick = () => fi.click();
  fi.onchange = () => { const f = [...fi.files]; fi.value = ""; if (f.length) importFiles(f); };
  fileDrop(dz, importFiles);
}
async function importFiles(files) {
  let last = null;
  for (const f of files) {
    try {
      toast(`Import de ${f.name}…`, 1500);
      const html = await fileToHtml(f);
      const id = api().newId("lessons");
      const l = cleanLesson({ title: f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), course: html, published: false });
      if (sizeOf(l) > 950000) { toast(`« ${f.name} » est trop lourd (images). Réduisez les images dans Word, ou rangez le fichier dans la Bibliothèque.`, 6000); continue; }
      await api().set("lessons/" + id, { ...l, createdAt: Date.now(), updatedAt: Date.now(), source: f.name }, false);
      S.lessons.push({ id, ...l, createdAt: Date.now() }); last = id;
    } catch (e) { fail(e); }
  }
  if (last) { await saveOrder(); toast(files.length > 1 ? `${files.length} fichiers importés en brouillon` : "Leçon importée en brouillon"); editLesson(last, "course"); }
}
function lessonMenu(id, x, y) {
  const l = lessonById(id);
  menu(x, y, [
    { icon: "✏️", label: "Modifier", act: () => editLesson(id) },
    { icon: "👁️", label: "Tester les exercices", act: () => testLesson(l, () => S.C.go("lessons")) },
    { icon: "👥", label: "Ajouter au parcours d'élèves…", act: () => assignLesson(l) },
    "-",
    { icon: l.published ? "🙈" : "✅", label: l.published ? "Repasser en brouillon" : "Publier", act: async () => { try { l.published = !l.published; await api().set("lessons/" + id, { published: l.published, updatedAt: Date.now() }); lessonsView(); } catch (e) { fail(e); } } },
    { icon: "📄", label: "Dupliquer", act: async () => { try { const nid = api().newId("lessons"); const copy = { ...cleanLesson(clone(l)), title: l.title + " (copie)", published: false }; await api().set("lessons/" + nid, { ...copy, createdAt: Date.now(), updatedAt: Date.now() }, false); S.lessons.splice(S.lessons.indexOf(l) + 1, 0, { id: nid, ...copy }); await saveOrder(); lessonsView(); toast("Copie créée (brouillon)"); } catch (e) { fail(e); } } },
    "-",
    { icon: "🗑️", label: "Supprimer", danger: true, act: async () => {
      const u = usage(id).length;
      if (!await confirmDlg(`Supprimer définitivement « ${esc(l.title)} » ?${u ? `<br><br>⚠️ Elle sera retirée du parcours de ${u} élève(s).` : ""}`, { ok: "Supprimer", danger: true })) return;
      try {
        await api().del("lessons/" + id); S.lessons = S.lessons.filter(x => x.id !== id); await saveOrder();
        for (const s of S.students) { const p = clone(S.plans[s.id]); if (p && removeItemsFromPlan(p, ["l:" + id])) await savePlan(s.id, p); }
        for (const t of S.templates) { const p = clone(t); if (removeItemsFromPlan(p, ["l:" + id])) { await api().set("templates/" + t.id, { chapters: p.chapters }); t.chapters = p.chapters; } }
        lessonsView(); toast("Leçon supprimée");
      } catch (e) { fail(e); }
    } },
  ]);
}
async function assignLesson(l) {
  const { pickStudents } = await import("./adm-state.js");
  const pre = usage(l.id).map(s => s.id);
  const chosen = await pickStudents({ title: `👥 « ${esc(l.title)} »`, intro: "Cochez les élèves qui doivent avoir cette leçon dans leur parcours (ajoutée à la fin, verrouillée : vous la débloquez quand vous voulez).", selected: pre, ok: "Enregistrer" });
  if (!chosen) return;
  try {
    for (const s of S.students) {
      const p = clone(S.plans[s.id]); if (!p) continue;
      const want = chosen.includes(s.id), had = pre.includes(s.id);
      let n = 0;
      if (want && !had) { const last = p.chapters[p.chapters.length - 1]; n = addItemsToPlan(p, [{ k: "l", id: l.id }], last?.id); }
      if (!want && had) n = removeItemsFromPlan(p, ["l:" + l.id]);
      if (n) await savePlan(s.id, p);
    }
    toast("Parcours mis à jour ✓"); lessonsView();
  } catch (e) { fail(e); }
}
async function installSeed(btn, onlyMissing) {
  btn.disabled = true; btn.textContent = "Installation…";
  try {
    for (const s of SEED) {
      if (onlyMissing && lessonById(s.id)) continue;
      const l = cleanLesson(s);
      await api().set("lessons/" + s.id, { ...l, createdAt: Date.now(), updatedAt: Date.now() }, false);
      if (!lessonById(s.id)) S.lessons.push({ id: s.id, ...l });
    }
    await saveOrder();
    if (!S.templates.length) { const { DEFAULT_TEMPLATE } = await import("./seed.js"); const id = api().newId("templates"); await api().set("templates/" + id, { ...DEFAULT_TEMPLATE, createdAt: Date.now() }, false); S.templates.push({ id, notes: {}, extra: {}, ...clone(DEFAULT_TEMPLATE) }); }
    toast("Leçons installées ✓ (et un parcours type « Débutant » créé)", 3500); lessonsView();
  } catch (e) { fail(e); btn.disabled = false; btn.textContent = "Réessayer"; }
}
export function testLesson(l, back, extra = []) {
  const list = [...autoVocabEx(l.vocab), ...l.ex, ...extra.map(x => ({ ...x, mine: true }))];
  if (!list.length) return toast("Aucun exercice à tester.");
  runQuiz({ title: "👁️ Test : " + esc(l.title), back, list, pass: l.passScore, preview: true, end: () => { setTimeout(() => { const b = $("#bk"); if (b) b.onclick = back; }); return `<p class="mute">Mode test : rien n'est enregistré.</p><button class="btn" id="bk">Retour</button>`; } });
}

/* =================== ÉDITEUR =================== */
export function editLesson(id, tab = "info") {
  const orig = id ? lessonById(id) : null;
  if (id && !orig) return S.C.go("lessons");
  const W = orig ? clone(orig) : { ...cleanLesson({ published: false }) };
  let isNew = !id; if (isNew) id = api().newId("lessons");
  let dirty = isNew, htmlMode = false;
  const mark = () => { dirty = true; const b = $("#save"); if (b) { b.disabled = false; b.textContent = "💾 Enregistrer"; } };
  S.C.guard(async () => !dirty || await confirmDlg("Des modifications ne sont pas enregistrées. Quitter quand même ?", { ok: "Quitter sans enregistrer", danger: true }));
  const back = () => S.C.go("lessons");

  const render = () => {
    ui.setTitle(`✏️ ${esc(W.emoji)} ${esc(W.title)}`, back);
    const tabs = [["info", "ℹ️ Infos"], ["course", "📘 Cours"], ["vocab", `🗣️ Vocabulaire (${W.vocab.length})`], ["ex", `✏️ Exercices (${W.ex.length})`], ["stu", "👥 Élèves"]];
    ui.m.innerHTML = `<div class="tabs">${tabs.map(t => `<button class="${tab === t[0] ? "on" : ""}" data-tab="${t[0]}">${t[1]}</button>`).join("")}</div><div id="pane"></div>
      <div class="sticky-save"><span class="mute" style="margin-right:auto">${W.published ? "✅ Publiée : visible par les élèves qui l'ont dans leur parcours" : "📝 Brouillon : invisible pour les élèves"}</span><button class="btn ghost" id="prev">👁️ Aperçu</button>${W.published ? "" : `<button class="btn okb" id="pub">✅ Publier</button>`}<button class="btn" id="save" ${dirty ? "" : "disabled"} title="${dirty ? "Enregistrer les modifications (Ctrl+S)" : "Tout est enregistré. Le bouton se réactive dès que vous modifiez quelque chose."}">${dirty ? "💾 Enregistrer" : "✓ Enregistré"}</button></div>`;
    $$("[data-tab]").forEach(b => b.onclick = () => { syncCourse(); tab = b.dataset.tab; render(); });
    $("#save").onclick = save;
    $("#prev").onclick = () => { syncCourse(); preview(); };
    const pb = $("#pub"); if (pb) pb.onclick = async () => { syncCourse(); W.published = true; dirty = true; await save(); if (!dirty) { toast("Leçon publiée ✓ Ajoutez-la au parcours de vos élèves (onglet 👥 Élèves).", 4000); render(); } else W.published = false; };
    ({ info, course, vocab, ex, stu })[tab]($("#pane"));
  };
  const syncCourse = () => { const r = $("#rte"), c = $("#code"); if (r) W.course = cleanHtml(r.innerHTML); if (c) W.course = c.value; };
  document.onkeydown = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && $("#save")) { e.preventDefault(); save(); } };
  async function save() {
    syncCourse();
    const doc = { ...cleanLesson(W), updatedAt: Date.now() };
    if (W.source) doc.source = W.source;
    if (!doc.title.trim()) return toast("Donnez un titre à la leçon.");
    if (sizeOf(doc) > 950000) return toast("Leçon trop lourde (> 1 Mo), sans doute à cause des images. Réduisez-les, ou rangez le document dans la Bibliothèque.", 6000);
    const b = $("#save"); b.disabled = true; b.textContent = "Enregistrement…";
    try {
      doc.createdAt = W.createdAt || Date.now(); W.createdAt = doc.createdAt;
      await api().set("lessons/" + id, doc, false);
      const i = S.lessons.findIndex(l => l.id === id);
      if (i < 0) { S.lessons.push({ id, ...doc }); await saveOrder(); } else S.lessons[i] = { id, ...doc };
      isNew = false; dirty = false; b.textContent = "✓ Enregistré"; toast("Leçon enregistrée ✓");
    } catch (e) { fail(e); b.disabled = false; b.textContent = "💾 Enregistrer"; }
  }
  function preview() {
    ui.setTitle(`👁️ ${esc(W.emoji)} ${esc(W.title)}`, () => render());
    ui.m.innerHTML = `<div class="note" style="margin-bottom:12px">Aperçu tel que l'élève le verra.</div>
      <div class="card"><span class="tag ${W.type}">${typeName(W.type)}</span>${W.goal ? `<p><b>Objectif :</b> ${esc(W.goal)}</p>` : ""}${W.support ? `<p><a class="btn ghost small" href="${esc(W.support)}" target="_blank" rel="noopener">📎 Ouvrir le support de cours</a></p>` : ""}</div>
      <div class="card course">${linkify(W.course)}</div>
      <div class="card">${W.vocab.map(v => `<div class="voc" data-say="${esc(v[0])}"><div><div class="it">${esc(v[0])}</div>${v[2] ? `<div class="ph">[${esc(v[2])}]</div>` : ""}<div class="mute">${esc(v[1])}</div></div><span class="sp">🔊</span></div>`).join("")}</div>
      <div class="row"><button class="btn ghost" id="pb">← Retour à l'édition</button><button class="btn" id="pt">Tester les exercices</button></div>`;
    $("#pb").onclick = render;
    $("#pt").onclick = () => testLesson(cleanLesson(W), render);
  }

  function info(p) {
    p.innerHTML = `<div class="card"><div class="grid2">
      <div><label class="f">Titre</label><input type="text" id="f_title" value="${esc(W.title)}"></div>
      <div class="grid2"><div><label class="f">Emoji</label><input type="text" id="f_emoji" value="${esc(W.emoji)}" maxlength="4"></div>
      <div><label class="f">Type</label><select id="f_type"><option value="T" ${W.type === "T" ? "selected" : ""}>Thème</option><option value="G" ${W.type === "G" ? "selected" : ""}>Grammaire</option><option value="A" ${W.type === "A" ? "selected" : ""}>Autre</option></select></div></div></div>
      <label class="f">Objectif (une phrase affichée en haut du cours)</label><input type="text" id="f_goal" value="${esc(W.goal)}">
      <label class="f">Lien externe (vidéo, page web… facultatif). Pour un fichier, utilisez plutôt la Bibliothèque.</label><input type="url" id="f_support" value="${esc(W.support)}" placeholder="https://…">
      <label class="f">Score pour réussir l'étape (%)</label><input type="number" id="f_pass" min="0" max="100" value="${W.passScore}" style="max-width:120px">
      <p></p>${sw('id="f_pub"', W.published, "Publiée (sinon brouillon, invisible pour tous les élèves)")}
    </div>${!isNew ? `<p class="mute">Créée ${fmtDate(orig?.createdAt)} · modifiée ${fmtDate(orig?.updatedAt)}${orig?.source ? ` · importée de « ${esc(orig.source)} »` : ""}</p>` : ""}`;
    const bind = (sel, key, f = v => v) => { const e = $(sel); e.oninput = e.onchange = () => { W[key] = f(e.type === "checkbox" ? e.checked : e.value); mark(); if (key === "title" || key === "emoji") ui.setTitle(`✏️ ${esc(W.emoji)} ${esc(W.title)}`, back); }; };
    bind("#f_title", "title"); bind("#f_emoji", "emoji"); bind("#f_type", "type"); bind("#f_goal", "goal"); bind("#f_support", "support");
    bind("#f_pass", "passScore", v => Math.max(0, Math.min(100, +v || 0))); bind("#f_pub", "published");
  }

  function course(p) {
    p.innerHTML = `<div class="toolbar" id="tb">
      <select data-c="block"><option value="">Style…</option><option value="h3">Titre</option><option value="p">Paragraphe</option></select>
      <button data-c="bold" title="Gras (Ctrl+B)"><b>G</b></button><button data-c="italic" title="Italique (Ctrl+I)"><i>I</i></button><button data-c="underline" title="Souligné"><u>S</u></button>
      <button data-c="insertUnorderedList">• Liste</button><button data-c="insertOrderedList">1. Liste</button>
      <button data-c="say" title="Rendre le texte sélectionné cliquable et prononcé">🔊 Audio</button>
      <button data-c="note" title="Encadré jaune">📝 Encadré</button><button data-c="model" title="Encadré modèle">💬 Modèle</button>
      <button data-c="table">▦ Tableau</button><button data-c="img">🖼️ Image</button><button data-c="link">🔗 Lien</button>
      <button data-c="removeFormat" title="Effacer la mise en forme">⌫ Format</button>
      <button data-c="import" title="Importer un Word ou PDF dans ce cours">📥 Word/PDF</button>
      <button data-c="html">${htmlMode ? "👁️ Visuel" : "&lt;/&gt; HTML"}</button></div>
      ${htmlMode ? `<textarea class="code" id="code">${esc(W.course)}</textarea>` : `<div class="rte course" id="rte" contenteditable="true">${W.course}</div>`}
      <input type="file" id="cf" accept=".docx,.pdf,.txt,.html,.htm" hidden><input type="file" id="imf" accept="image/*" hidden>
      <p class="mute">Astuce : sélectionnez une phrase espagnole puis <b>🔊 Audio</b> : elle est entourée de [[ ]] et l'élève peut l'écouter. Vous pouvez aussi glisser un Word ou un PDF directement dans la zone d'édition.</p>`;
    const rte = $("#rte"), code = $("#code");
    if (rte) { rte.oninput = mark; fileDrop(rte, f => importInto(f[0])); }
    if (code) code.oninput = mark;
    const exec = (c, v = null) => { rte.focus(); document.execCommand(c, false, v); mark(); };
    const insertHtml = h => { rte.focus(); document.execCommand("insertHTML", false, h); mark(); };
    let saved = null;
    const keepSel = () => { const s = getSelection(); saved = s.rangeCount && rte && rte.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null; };
    const restoreSel = () => { if (saved) { const s = getSelection(); s.removeAllRanges(); s.addRange(saved); } };
    $("#tb").onmousedown = e => { if (e.target.closest("button")) e.preventDefault(); };
    $("#tb").onclick = $("#tb").onchange = async e => {
      const b = e.target.closest("[data-c]"); if (!b) return;
      const c = b.dataset.c;
      if (e.type === "click" && b.tagName === "SELECT") return;
      if (c === "html") { syncCourse(); htmlMode = !htmlMode; return course(p); }
      if (c === "import") return $("#cf").click();
      if (htmlMode) return toast("Repassez en mode visuel pour utiliser la barre d'outils.");
      if (c === "block") { if (b.value) exec("formatBlock", b.value); b.value = ""; return; }
      if (c === "say") { const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return toast("Sélectionnez d'abord une phrase."); return exec("insertText", "[[" + s.toString() + "]]"); }
      if (c === "note" || c === "model") { const s = getSelection(); const t = s && !s.isCollapsed ? esc(s.toString()) : "Votre texte ici"; return insertHtml(`<div class="${c}">${t}</div><p><br></p>`); }
      if (c === "table") {
        keepSel();
        const r = await modal({ title: "Insérer un tableau", body: `<div class="grid2"><div><label class="f">Lignes</label><input type="number" id="tr" value="3" min="1" max="40"></div><div><label class="f">Colonnes</label><input type="number" id="tc" value="2" min="1" max="8"></div></div>`, buttons: [{ label: "Annuler", value: null }, { label: "Insérer", primary: true, act: a => [+a.body.querySelector("#tr").value, +a.body.querySelector("#tc").value] }] }).result;
        if (!r) return; restoreSel();
        return insertHtml(`<table>${Array.from({ length: r[0] }, () => `<tr>${Array.from({ length: r[1] }, () => "<td>&nbsp;</td>").join("")}</tr>`).join("")}</table><p><br></p>`);
      }
      if (c === "img") { keepSel(); return $("#imf").click(); }
      if (c === "link") { keepSel(); const u = await promptDlg("Adresse du lien", "https://", { ok: "Insérer" }); if (u) { restoreSel(); exec("createLink", u); } return; }
      if (b.tagName === "BUTTON") exec(c);
    };
    $("#imf").onchange = async e => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; try { const src = await compressImage(f); restoreSel(); insertHtml(`<img src="${src}" alt="">`); } catch (err) { toast("Image illisible."); } };
    $("#cf").onchange = e => { const f = e.target.files[0]; e.target.value = ""; if (f) importInto(f); };
    async function importInto(f) {
      try {
        toast("Import en cours…", 1500);
        const html = await fileToHtml(f);
        syncCourse();
        let how = "replace";
        if (W.course.trim()) how = await choiceDlg("Importer « " + esc(f.name) + " »", "Le cours contient déjà du texte.", [{ label: "Ajouter à la fin", value: "add" }, { label: "Remplacer le cours", value: "replace" }]);
        if (!how) return;
        W.course = how === "replace" ? html : W.course + "<hr>" + html; mark(); course(p);
        toast("Contenu importé ✓");
      } catch (err) { fail(err); }
    }
  }

  function vocab(p) {
    p.innerHTML = `<div class="card"><div class="list" id="vl">${W.vocab.map((v, i) => `<div class="item" data-id="${i}"><span class="handle">⠿</span><div class="grid3" style="flex:1">
      <input type="text" data-k="0" data-i="${i}" value="${esc(v[0])}" placeholder="Espagnol"><input type="text" data-k="1" data-i="${i}" value="${esc(v[1])}" placeholder="Français"><input type="text" data-k="2" data-i="${i}" value="${esc(v[2] || "")}" placeholder="Prononciation">
      <div class="row tight"><button class="ib" data-say="${esc(v[0])}" title="Écouter">🔊</button><button class="ib" data-rm="${i}" title="Supprimer">🗑️</button></div></div></div>`).join("") || '<p class="mute">Aucun mot pour l\'instant.</p>'}</div>
      <button class="btn" id="vadd">+ Ajouter un mot</button></div>
      <details class="card"><summary>📋 Coller une liste</summary><p class="mute">Une ligne par mot : <code>espagnol ; français ; prononciation</code>. Un copier-coller d'un tableau Word ou Excel fonctionne aussi.</p><textarea id="vpaste" placeholder="la casa ; la maison ; KA-sa"></textarea><p><button class="btn ghost" id="vimp">Ajouter ces mots</button></p></details>
      <details class="card"><summary>🔎 Récupérer le vocabulaire depuis les tableaux du cours</summary><p class="mute">Après un import Word : chaque ligne des tableaux à 2 ou 3 colonnes devient un mot.</p><button class="btn ghost" id="vtab">Extraire depuis les tableaux</button></details>`;
    $$("#vl input").forEach(e => e.oninput = () => { W.vocab[+e.dataset.i][+e.dataset.k] = e.value; mark(); });
    $$("[data-rm]").forEach(b => b.onclick = () => { W.vocab.splice(+b.dataset.rm, 1); mark(); vocab(p); });
    $("#vadd").onclick = () => { W.vocab.push(["", "", ""]); mark(); vocab(p); const ins = $$("#vl input[data-k='0']"); ins[ins.length - 1]?.focus(); };
    $("#vimp").onclick = () => {
      const rows = $("#vpaste").value.split(/\n/).map(l => l.split(/\s*[;\t|]\s*/).map(s => s.trim())).filter(r => r[0] && r[1]);
      if (!rows.length) return toast("Rien à importer : vérifiez le format.");
      W.vocab.push(...rows.map(r => [r[0], r[1], r[2] || ""])); mark(); vocab(p); toast(`${rows.length} mot(s) ajouté(s)`);
    };
    $("#vtab").onclick = async () => {
      const d = document.createElement("div"); d.innerHTML = W.course; const rows = [];
      d.querySelectorAll("tr").forEach(tr => { const c = [...tr.children].map(td => td.textContent.replace(/\[\[|\]\]/g, "").trim()); if (c.length >= 2 && c.length <= 3 && c[0] && c[1] && tr.children[0].tagName !== "TH") rows.push([c[0], c[1], c[2] || ""]); });
      if (!rows.length) return toast("Aucun tableau à 2-3 colonnes trouvé dans le cours.");
      if (!await confirmDlg(`${rows.length} ligne(s) trouvée(s). Les ajouter au vocabulaire ?`, { ok: "Ajouter" })) return;
      W.vocab.push(...rows); mark(); vocab(p);
    };
    sortableList($("#vl"), ".item", ids => { W.vocab = ids.map(i => W.vocab[+i]); mark(); vocab(p); });
  }

  function ex(p) {
    p.innerHTML = `<div id="exed"></div><p class="mute">En plus de ces exercices, l'élève reçoit 3 questions automatiques tirées du vocabulaire (s'il y a au moins 4 mots). Vous pouvez aussi ajouter des exercices réservés à un élève depuis son parcours.</p>`;
    exEditor($("#exed"), W.ex, mark, () => { const t = $$(".tabs button")[3]; if (t) t.textContent = `✏️ Exercices (${W.ex.length})`; });
  }

  function stu(p) {
    if (!S.students.length) { p.innerHTML = `<div class="card mute">Pas encore d'élève. Invitez-en depuis l'onglet 👥 Élèves.</div>`; return; }
    if (isNew) { p.innerHTML = `<div class="card mute">Enregistrez d'abord la leçon, puis revenez ici.</div>`; return; }
    const key = "l:" + id;
    p.innerHTML = `<div class="card"><p class="mute">Ajoutez ou retirez cette leçon du parcours de chaque élève, et réglez son état. Enregistré immédiatement. Pour choisir le chapitre et la position exacte, ouvrez la fiche de l'élève.${W.published ? "" : "<br><b>La leçon est en brouillon : aucun élève ne la voit tant qu'elle n'est pas publiée.</b>"}</p>
      ${S.students.map(s => { const pl = S.plans[s.id], has = planHas(s.id, key), stt = pl?.state?.[key] || "locked", sc = S.progress[s.id]?.done?.[id];
        return `<div class="vrow row" style="align-items:center"><span class="row tight" style="align-items:center"><span class="av">${esc(initials(s))}</span><span><b>${esc(sName(s))}</b>${sc != null ? `<br><small class="mute">meilleur score ${sc} %</small>` : ""}</span></span>
        <span class="row tight" style="align-items:center">${sw(`data-in="${s.id}"`, has, "Dans son parcours")}${has ? stateSeg(s.id, stt) : ""}<button class="ib" data-open="${s.id}" title="Ouvrir la fiche">›</button></span></div>`; }).join("")}</div>`;
    $$("[data-in]").forEach(e => e.onchange = async () => {
      const uid = e.dataset.in, pl = clone(S.plans[uid]);
      try {
        if (e.checked) addItemsToPlan(pl, [{ k: "l", id }], pl.chapters[pl.chapters.length - 1]?.id); else removeItemsFromPlan(pl, [key]);
        await savePlan(uid, pl); toast("Enregistré"); stu(p);
      } catch (er) { fail(er); }
    });
    $$("[data-st]").forEach(b => b.onclick = async () => { const [uid, v] = b.dataset.st.split("|"); const pl = clone(S.plans[uid]); pl.state[key] = v; try { await savePlan(uid, pl); stu(p); } catch (er) { fail(er); } });
    $$("[data-open]").forEach(b => b.onclick = () => S.C.go("student", b.dataset.open));
  }
  render();
}
export const stateSeg = (attr, st) => `<span class="seg">${[["open", "🔓", "Ouverte"], ["locked", "🔒", "Verrouillée"], ["hidden", "🙈", "Cachée"]].map(([v, i, t]) => `<button class="${st === v ? "on" : ""}" data-st="${attr}|${v}" title="${t}">${i}</button>`).join("")}</span>`;

/* =================== ÉDITEUR D'EXERCICES (réutilisable) =================== */
const EXT = { q: "Choix multiple", w: "Réponse écrite", o: "Remettre dans l'ordre", n: "Dictée de nombre" };
let exN = 0;
export function exEditor(box, arr, onChange, onCount = () => {}) {
  const uid = "x" + (++exN);
  const draw = () => {
    box.innerHTML = `<div class="list" id="exl_${uid}">${arr.map((x, i) => `<div class="exbox" data-id="${i}">
      <div class="head"><span class="handle">⠿</span><b>${i + 1}.</b><select data-ty="${i}">${Object.entries(EXT).map(([k, v]) => `<option value="${k}" ${x.t === k ? "selected" : ""}>${v}</option>`).join("")}</select><span style="flex:1"></span><button class="ib" data-dup="${i}" title="Dupliquer">📄</button><button class="ib" data-del="${i}" title="Supprimer">🗑️</button></div>
      ${fields(x, i)}</div>`).join("") || '<p class="mute">Aucun exercice.</p>'}</div>
      <div class="row tight"><select id="nt_${uid}" style="width:auto">${Object.entries(EXT).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select><button class="btn small" id="add_${uid}">+ Ajouter un exercice</button></div>`;
    $$("[data-f]", box).forEach(e => e.oninput = e.onchange = () => {
      const x = arr[+e.dataset.i], f = e.dataset.f;
      if (/^o[0-3]$/.test(f)) { x.o = x.o || ["", "", "", ""]; x.o[+f[1]] = e.value; }
      else if (f === "a" && x.t === "w") x.a = e.value.split("\n").map(s => s.trim()).filter(Boolean);
      else if (f === "map") x.map = e.checked ? 1 : 0;
      else if (f === "max") x.max = +e.value || 20;
      else x[f] = e.value;
      onChange();
    });
    $$("[data-ty]", box).forEach(e => e.onchange = () => { const i = +e.dataset.ty; arr[i] = blank(e.value, arr[i]); onChange(); draw(); });
    $$("[data-del]", box).forEach(b => b.onclick = async () => { if (!await confirmDlg("Supprimer cet exercice ?", { ok: "Supprimer", danger: true })) return; arr.splice(+b.dataset.del, 1); onChange(); onCount(); draw(); });
    $$("[data-dup]", box).forEach(b => b.onclick = () => { const i = +b.dataset.dup; arr.splice(i + 1, 0, clone(arr[i])); onChange(); onCount(); draw(); });
    $("#add_" + uid).onclick = () => { arr.push(blank($("#nt_" + uid).value)); onChange(); onCount(); draw(); const bx = $$(".exbox", box); bx[bx.length - 1]?.querySelector("input,textarea")?.focus(); };
    sortableList($("#exl_" + uid), ".exbox", ids => { const c = ids.map(i => arr[+i]); arr.splice(0, arr.length, ...c); onChange(); draw(); });
  };
  const blank = (t, prev = {}) => t === "q" ? { t, q: prev.q || "", o: ["", "", "", ""], x: prev.x || "" } : t === "w" ? { t, q: prev.q || "", a: [], x: prev.x || "" } : t === "o" ? { t, q: prev.q || "", a: "" } : { t: "n", max: 20 };
  const inp = (f, i, v, ph) => `<input type="text" data-f="${f}" data-i="${i}" value="${esc(v ?? "")}" placeholder="${ph}">`;
  const fields = (x, i) => {
    if (x.t === "q") { const o = x.o || []; return `<label class="f">Question</label>${inp("q", i, x.q, "ex. « la casa » veut dire…")}
      <label class="f">✅ Bonne réponse</label>${inp("o0", i, o[0], "La bonne réponse")}
      <label class="f">❌ Mauvaises réponses</label><div class="grid2">${inp("o1", i, o[1], "Fausse 1")}${inp("o2", i, o[2], "Fausse 2")}</div><div style="margin-top:6px">${inp("o3", i, o[3], "Fausse 3 (facultatif)")}</div>
      <label class="f">Explication (affichée après la réponse, facultatif)</label>${inp("x", i, x.x, "")}
      <p></p>${sw(`data-f="map" data-i="${i}"`, !!x.map, "Afficher le plan de la ville au-dessus")}`; }
    if (x.t === "w") return `<label class="f">Question / consigne</label>${inp("q", i, x.q, "ex. Traduisez : J'ai trente ans.")}
      <label class="f">Réponses acceptées (une par ligne — les accents oubliés sont tolérés)</label><textarea data-f="a" data-i="${i}" style="min-height:70px">${esc((x.a || []).join("\n"))}</textarea>
      <label class="f">Explication (facultatif)</label>${inp("x", i, x.x, "")}`;
    if (x.t === "o") return `<label class="f">Phrase en français (consigne)</label>${inp("q", i, x.q, "Je peux payer par carte ?")}
      <label class="f">Phrase espagnole correcte (les mots seront mélangés)</label>${inp("a", i, x.a, "¿Puedo pagar con tarjeta?")}`;
    return `<label class="f">Nombre maximum (un nombre au hasard entre 0 et ce maximum est dicté)</label><input type="number" data-f="max" data-i="${i}" value="${x.max || 20}" style="max-width:140px">`;
  };
  draw();
}
