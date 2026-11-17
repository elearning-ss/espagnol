// Constructeur de parcours (élève ou parcours type) : glisser-déposer en deux panneaux.
// À gauche : leçons et bibliothèque. À droite : chapitres et leurs éléments.
import { $, $$, esc, buildPath, ikey, newId, fmtDate, typeName } from "./core.js";
import { modal, confirmDlg, promptDlg, menu, toast, draggable, dropZone } from "./ui.js";
import { S, lib, subFolders, folderFiles, folderById, folderPath } from "./adm-state.js";
import { fileKind, kindIcon, fmtSize } from "./files.js";
import { exEditor, stateSeg, testLesson } from "./adm-lessons.js";

const collapsed = new Set();
let leftTab = "l", leftFolder = null, leftQ = "";

/* opts : { kind: "student"|"template", uid?, progress?, onChange() } — modifie `plan` en place */
export function pathBuilder(box, plan, opts) {
  const isStu = opts.kind === "student";
  const changed = () => { opts.onChange(); draw(); };
  const inPlan = () => new Set(plan.chapters.flatMap(c => c.items.map(ikey)));
  const findItem = key => { for (const c of plan.chapters) { const i = c.items.findIndex(x => ikey(x) === key); if (i >= 0) return { c, i }; } return null; };
  const add = (items, chId, refKey) => {
    const ch = plan.chapters.find(c => c.id === chId) || plan.chapters[plan.chapters.length - 1] || (plan.chapters.push({ id: newId(), title: "Chapitre 1", items: [] }), plan.chapters[0]);
    for (const it of items) {
      const k = ikey(it), cur = findItem(k);
      if (cur) cur.c.items.splice(cur.i, 1); // déjà présent : on le déplace
      let pos = refKey ? ch.items.findIndex(x => ikey(x) === refKey) : -1;
      if (pos < 0) pos = ch.items.length;
      ch.items.splice(pos, 0, { k: it.k, id: it.id });
    }
  };

  const draw = () => {
    const P = buildPath(plan, lib(), opts.progress || {});
    const used = inPlan();
    const nItems = P.reduce((a, c) => a + c.items.length, 0);
    box.innerHTML = `<div class="builder">
      <aside class="src">
        <div class="src-h"><b>➕ Ajouter</b><span class="mute">glissez vers un chapitre</span></div>
        <div class="tabs sm"><button data-lt="l" class="${leftTab === "l" ? "on" : ""}">🎓 Leçons</button><button data-lt="b" class="${leftTab === "b" ? "on" : ""}">🗂️ Bibliothèque</button></div>
        <input type="search" id="srcq" placeholder="🔎 Filtrer" value="${esc(leftQ)}">
        <div class="src-list scrolly" id="srcl">${leftTab === "l" ? srcLessons(used) : srcLib(used)}</div>
      </aside>
      <section class="chaps">
        <div class="row tight" style="align-items:center;margin-bottom:8px"><span class="mute">${P.length} chapitre${P.length > 1 ? "s" : ""} · ${nItems} élément${nItems > 1 ? "s" : ""}</span><span style="flex:1"></span>
          <button class="btn ghost small" id="colall">${P.every(c => collapsed.has(c.id)) ? "Tout déplier" : "Tout replier"}</button><button class="btn small" id="addch">+ Nouveau chapitre</button></div>
        ${isStu ? `<div class="legend mute">🔓 ouvert · 🔒 verrouillé (visible, pas encore accessible) · 🙈 caché (préparé, invisible pour l'élève)</div>` : `<div class="legend mute">L'état choisi ici (🔓 / 🔒 / 🙈) sera l'état de départ quand vous appliquerez ce parcours à un élève.</div>`}
        <div id="chl">${P.map((c, ci) => chapHtml(c, ci, isStu)).join("") || `<div class="empty">Aucun chapitre. Créez-en un, ou appliquez un parcours type.</div>`}</div>
      </section></div>`;
    bind(P);
  };

  const srcLessons = used => {
    const q = leftQ.toLowerCase();
    const L = S.lessons.filter(l => !q || l.title.toLowerCase().includes(q));
    return L.map(l => `<div class="srci ${used.has("l:" + l.id) ? "used" : ""}" data-add="l:${l.id}" title="Glissez vers un chapitre"><span>${esc(l.emoji)}</span><span class="t">${esc(l.title)}${l.published ? "" : ' <span class="tag D">brouillon</span>'}</span>${used.has("l:" + l.id) ? '<span class="ok" title="Déjà dans le parcours">✓</span>' : `<button class="ib" data-plus="l:${l.id}" title="Ajouter au dernier chapitre">＋</button>`}</div>`).join("") || `<p class="mute">Aucune leçon.</p>`;
  };
  const srcLib = used => {
    const q = leftQ.toLowerCase();
    let ds, fs;
    if (q) { ds = S.folders.filter(f => f.name.toLowerCase().includes(q)); fs = S.files.filter(f => f.name.toLowerCase().includes(q)); }
    else { ds = subFolders(leftFolder); fs = folderFiles(leftFolder); }
    const crumbs = q ? "" : `<div class="crumbs sm"><span class="cr" data-lf="">🗂️</span>${folderPath(leftFolder).map(f => `<span class="crs">›</span><span class="cr" data-lf="${f.id}">${esc(f.name)}</span>`).join("")}</div>`;
    const row = (k, o, ic, sub) => `<div class="srci ${used.has(k) ? "used" : ""}" data-add="${k}" ${k[0] === "d" ? `data-nav="${o.id}"` : ""}><span>${ic}</span><span class="t">${esc(o.name)}<br><small class="mute">${sub}</small></span>${used.has(k) ? '<span class="ok">✓</span>' : `<button class="ib" data-plus="${k}" title="Ajouter au dernier chapitre">＋</button>`}</div>`;
    return crumbs + ds.map(d => row("d:" + d.id, d, "📁", `dossier · ${subFolders(d.id).length + folderFiles(d.id).length} élément(s) · double-clic pour ouvrir`)).join("") + fs.map(f => row("f:" + f.id, f, kindIcon(fileKind(f.name, f.type)), fmtSize(f.size))).join("") || crumbs + `<p class="mute">${q ? "Aucun résultat." : "Dossier vide. Ajoutez des fichiers dans 🗂️ Bibliothèque."}</p>`;
  };

  const chapHtml = (c, ci, isStu) => {
    const col = collapsed.has(c.id), ls = c.items.filter(i => i.k === "l" && i.obj), done = ls.filter(i => i.passed).length;
    return `<div class="chap" data-k="${c.id}">
      <div class="chap-h"><span class="handle" title="Glisser pour réordonner les chapitres">⠿</span><button class="ib tw" data-col="${c.id}">${col ? "▸" : "▾"}</button>
        <input class="chap-t" data-title="${c.id}" value="${esc(c.title)}" title="Cliquez pour renommer">
        <span class="mute nowrap">${c.items.length} élément${c.items.length > 1 ? "s" : ""}${isStu && ls.length ? ` · ${done}/${ls.length} réussies` : ""}</span>
        <button class="ib" data-addin="${c.id}" title="Ajouter des éléments">＋</button><button class="ib" data-chm="${c.id}" title="Plus d'actions">⋯</button></div>
      ${col ? "" : `<div class="chap-b" data-list="${c.id}">${c.items.map(it => itemHtml(it, isStu)).join("")}<div class="drop-hint">Glissez ici des leçons, documents ou dossiers</div></div>`}
    </div>`;
  };
  const itemHtml = (it, isStu) => {
    const o = it.obj;
    let ic, title, sub = "";
    if (!o) { ic = "⚠️"; title = "Élément supprimé"; sub = "Il n'existe plus : retirez-le."; }
    else if (it.k === "l") {
      ic = esc(o.emoji); title = esc(o.title);
      const at = (opts.progress?.attempts?.[it.id] || []);
      sub = `<span class="tag ${o.type}">${typeName(o.type)}</span>${o.published ? "" : ' <span class="tag D">brouillon</span>'}`;
      if (isStu) sub += it.score ? ` meilleur <b>${it.score} %</b>${at.length ? ` · ${at.length} essai${at.length > 1 ? "s" : ""} · ${fmtDate(at[at.length - 1].at)}` : ""}` : " <span class=\"mute\">pas encore fait</span>";
      if (isStu && (plan.notes[it.id] || plan.extra[it.id]?.length)) sub += ` · ${plan.notes[it.id] ? "📝" : ""}${plan.extra[it.id]?.length ? `✍️${plan.extra[it.id].length}` : ""}`;
    } else if (it.k === "f") { ic = kindIcon(fileKind(o.name, o.type)); title = esc(o.name); sub = `Document · ${fmtSize(o.size)}`; }
    else { ic = "📁"; title = esc(o.name); sub = `Dossier · ${subFolders(o.id).length + folderFiles(o.id).length} élément(s) (et leur contenu)`; }
    const auto = isStu && plan.mode === "auto" && it.k === "l" && it.state === "locked" && it.unlocked;
    return `<div class="pi ${it.state === "hidden" ? "hid" : ""} ${it.passed ? "passed" : ""}" data-k="${it.key}">
      <span class="handle">⠿</span><span class="pic">${it.passed ? "✅" : ic}</span>
      <div class="t"><b>${title}</b><div class="sub">${sub}${auto ? ' · <span class="tag OK">ouverte (auto)</span>' : ""}</div>${isStu && it.k === "l" && it.score ? `<div class="minibar"><i style="width:${it.score}%"></i></div>` : ""}</div>
      ${o ? stateSeg(it.key, it.state) : ""}
      ${isStu && it.k === "l" && o ? `<button class="ib" data-perso="${it.id}" title="Note et exercices pour cet élève">✍️</button>` : ""}
      <button class="ib" data-im="${it.key}" title="Plus d'actions">⋯</button>
    </div>${isStu && it.k === "l" && openPerso.has(it.id) ? `<div class="perso" data-perso-box="${it.id}"></div>` : ""}`;
  };
  const openPerso = opts.openPerso || (opts.openPerso = new Set());

  const bind = P => {
    // panneau de gauche
    $$("[data-lt]", box).forEach(b => b.onclick = () => { leftTab = b.dataset.lt; draw(); });
    const sq = $("#srcq", box); sq.oninput = () => { leftQ = sq.value; $("#srcl", box).innerHTML = leftTab === "l" ? srcLessons(inPlan()) : srcLib(inPlan()); bindSrc(); };
    const bindSrc = () => {
      $$("[data-lf]", box).forEach(c => c.onclick = () => { leftFolder = c.dataset.lf || null; draw(); });
      $$("[data-nav]", box).forEach(r => r.ondblclick = () => { leftFolder = r.dataset.nav; leftQ = ""; draw(); });
      $$("[data-plus]", box).forEach(b => b.onclick = () => { const [k, id] = b.dataset.plus.split(":"); add([{ k, id }]); changed(); toast("Ajouté au dernier chapitre"); });
    };
    bindSrc();
    draggable($("#srcl", box), { selector: ".srci:not(.used)", payload: el => { const [k, id] = el.dataset.add.split(":"); return { kind: "add", items: [{ k, id }] }; }, label: (p, el) => el.querySelector("span").outerHTML + " " + esc(el.querySelector(".t").innerText.split("\n")[0]) });
    // chapitres
    $("#addch", box).onclick = async () => { const t = await promptDlg("Nouveau chapitre", `Chapitre ${plan.chapters.length + 1}`, { ok: "Créer" }); if (t) { plan.chapters.push({ id: newId(), title: t, items: [] }); changed(); } };
    $("#colall", box).onclick = () => { const all = P.every(c => collapsed.has(c.id)); P.forEach(c => all ? collapsed.delete(c.id) : collapsed.add(c.id)); draw(); };
    $$("[data-col]", box).forEach(b => b.onclick = () => { const id = b.dataset.col; collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); draw(); });
    $$("[data-title]", box).forEach(i => { i.onchange = () => { const c = plan.chapters.find(x => x.id === i.dataset.title); c.title = i.value.trim() || c.title; opts.onChange(); }; i.onkeydown = e => { if (e.key === "Enter") i.blur(); }; });
    $$("[data-chm]", box).forEach(b => b.onclick = () => { const r = b.getBoundingClientRect(); chapMenu(b.dataset.chm, r.right - 230, r.bottom + 4); });
    $$("[data-addin]", box).forEach(b => b.onclick = () => pickItems(b.dataset.addin));
    $$("[data-st]", box).forEach(b => b.onclick = () => { const [key, v] = b.dataset.st.split("|"); plan.state[key] = v; changed(); });
    $$("[data-im]", box).forEach(b => b.onclick = () => { const r = b.getBoundingClientRect(); itemMenu(b.dataset.im, r.right - 240, r.bottom + 4); });
    $$(".pi", box).forEach(el => el.oncontextmenu = e => { e.preventDefault(); itemMenu(el.dataset.k, e.clientX, e.clientY); });
    $$("[data-perso]", box).forEach(b => b.onclick = () => { const id = b.dataset.perso; openPerso.has(id) ? openPerso.delete(id) : openPerso.add(id); draw(); });
    $$("[data-perso-box]", box).forEach(pb => {
      const id = pb.dataset.persoBox, l = S.lessons.find(x => x.id === id);
      pb.innerHTML = `<label class="f">📝 Note pour l'élève sur cette leçon (affichée en haut du cours)</label><textarea class="pn">${esc(plan.notes[id] || "")}</textarea>
        <label class="f">✍️ Exercices réservés à cet élève (ajoutés à ceux de la leçon)</label><div class="px"></div>
        <p class="row tight"><button class="btn ghost small" data-tst>👁️ Tester comme l'élève</button><button class="btn ghost small" data-cls>Fermer</button></p>`;
      pb.querySelector(".pn").oninput = e => { plan.notes[id] = e.target.value; opts.onChange(); };
      plan.extra[id] = plan.extra[id] || [];
      exEditor(pb.querySelector(".px"), plan.extra[id], opts.onChange);
      pb.querySelector("[data-tst]").onclick = () => { const back = opts.onTestBack || (() => draw()); testLesson(l, back, plan.extra[id]); };
      pb.querySelector("[data-cls]").onclick = () => { openPerso.delete(id); draw(); };
    });
    // glisser-déposer : éléments
    $$("[data-list]", box).forEach(list => {
      draggable(list, { selector: ".pi", handle: ".handle", payload: el => ({ kind: "move", key: el.dataset.k }), label: (p, el) => el.querySelector(".pic").outerHTML + " " + el.querySelector("b").outerHTML });
      dropZone(list, { list: true, item: ".pi", end: ".drop-hint", accept: p => p.kind === "add" || p.kind === "move", drop: (p, i, z) => {
        const kids = [...z.children].filter(c => c.matches(".pi")), ref = kids[i]?.dataset.k || null;
        if (p.kind === "move") { if (ref === p.key) return; const [k, id] = p.key.split(":"); add([{ k, id }], z.dataset.list, ref); }
        else add(p.items, z.dataset.list, ref);
        changed();
      } });
    });
    // chapitres repliés : on peut quand même déposer sur l'en-tête
    $$(".chap", box).forEach(ch => { if (collapsed.has(ch.dataset.k)) dropZone(ch.querySelector(".chap-h"), { accept: p => p.kind === "add" || p.kind === "move", drop: p => { const items = p.kind === "add" ? p.items : [{ k: p.key.split(":")[0], id: p.key.split(":")[1] }]; add(items, ch.dataset.k); changed(); } }); });
    // glisser-déposer : chapitres
    const chl = $("#chl", box);
    draggable(chl, { selector: ".chap", handle: ".chap-h > .handle", payload: el => ({ kind: "chap", id: el.dataset.k }), label: (p, el) => "📚 " + esc(el.querySelector(".chap-t").value) });
    dropZone(chl, { list: true, item: ".chap", accept: p => p.kind === "chap", drop: (p, i, z) => {
      const kids = [...z.children].filter(c => c.matches(".chap")), ref = kids[i]?.dataset.k;
      if (ref === p.id) return;
      const c = plan.chapters.splice(plan.chapters.findIndex(x => x.id === p.id), 1)[0];
      const at = ref ? plan.chapters.findIndex(x => x.id === ref) : plan.chapters.length;
      plan.chapters.splice(at < 0 ? plan.chapters.length : at, 0, c); changed();
    } });
  };

  const chapMenu = (id, x, y) => {
    const c = plan.chapters.find(z => z.id === id), keys = c.items.map(ikey);
    const setAll = v => { keys.forEach(k => plan.state[k] = v); changed(); };
    menu(x, y, [
      { icon: "＋", label: "Ajouter des éléments…", act: () => pickItems(id) },
      { icon: "🔓", label: "Tout ouvrir", act: () => setAll("open") },
      { icon: "🔒", label: "Tout verrouiller", act: () => setAll("locked") },
      { icon: "🙈", label: "Tout cacher", act: () => setAll("hidden") },
      "-",
      { icon: "⬆️", label: "Monter", disabled: plan.chapters[0] === c, act: () => { const i = plan.chapters.indexOf(c); plan.chapters.splice(i, 1); plan.chapters.splice(i - 1, 0, c); changed(); } },
      { icon: "⬇️", label: "Descendre", disabled: plan.chapters[plan.chapters.length - 1] === c, act: () => { const i = plan.chapters.indexOf(c); plan.chapters.splice(i, 1); plan.chapters.splice(i + 1, 0, c); changed(); } },
      { icon: "📄", label: "Dupliquer le chapitre", act: () => { const i = plan.chapters.indexOf(c); plan.chapters.splice(i + 1, 0, { id: newId(), title: c.title + " (copie)", items: [] }); toast("Chapitre vide créé (un élément ne peut être qu'à un seul endroit du parcours)", 3500); changed(); } },
      "-",
      { icon: "🗑️", label: "Supprimer le chapitre", danger: true, act: async () => { if (c.items.length && !await confirmDlg(`Supprimer « ${esc(c.title)} » et retirer ses ${c.items.length} élément(s) du parcours ?`, { ok: "Supprimer", danger: true })) return; plan.chapters.splice(plan.chapters.indexOf(c), 1); changed(); } },
    ]);
  };
  const itemMenu = (key, x, y) => {
    const f = findItem(key); if (!f) return;
    const [k, id] = key.split(":");
    const others = plan.chapters.filter(c => c !== f.c);
    menu(x, y, [
      ...(k === "l" && isStu ? [{ icon: "🔓", label: "Ouvrir jusqu'ici (et tout ce qui précède)", act: () => { for (const c of plan.chapters) for (const it of c.items) { if (it.k === "l") plan.state[ikey(it)] = "open"; if (ikey(it) === key) return changed(); } } }] : []),
      ...(k === "l" ? [{ icon: "✏️", label: "Modifier la leçon", act: () => S.C.go("lesson", id) }] : []),
      ...(k === "l" && isStu ? [{ icon: "✍️", label: "Note et exercices perso", act: () => { openPerso.add(id); draw(); } }] : []),
      ...(k !== "l" ? [{ icon: "🗂️", label: "Voir dans la bibliothèque", act: () => S.C.go("library", k === "d" ? id : (S.files.find(z => z.id === id)?.folder || null)) }] : []),
      "-",
      ...others.map(c => ({ icon: "↪️", label: "Déplacer vers « " + c.title.slice(0, 30) + " »", act: () => { add([{ k, id }], c.id); changed(); } })),
      ...(others.length ? ["-"] : []),
      { icon: "✕", label: "Retirer du parcours", danger: true, act: () => { f.c.items.splice(f.i, 1); delete plan.state[key]; changed(); } },
    ]);
  };
  // Sélecteur (utile sur téléphone, ou pour ajouter plusieurs éléments d'un coup)
  const pickItems = chId => {
    const used = inPlan(), body = document.createElement("div");
    const row = (k, ic, t, sub) => `<label class="pk ${used.has(k) ? "used" : ""}"><input type="checkbox" value="${k}" ${used.has(k) ? "disabled checked" : ""}><span style="font-size:20px">${ic}</span><span><b>${esc(t)}</b>${sub ? `<br><small class="mute">${esc(sub)}</small>` : ""}</span></label>`;
    body.innerHTML = `<input type="search" class="pk-q" placeholder="🔎 Rechercher" style="margin-bottom:8px"><div class="scrolly" style="max-height:55vh;overflow:auto">
      <p class="mute" style="margin:4px 0"><b>🎓 Leçons</b></p>${S.lessons.map(l => row("l:" + l.id, l.emoji, l.title, typeName(l.type))).join("") || '<p class="mute">Aucune.</p>'}
      <p class="mute" style="margin:12px 0 4px"><b>🗂️ Bibliothèque</b></p>${S.folders.map(d => row("d:" + d.id, "📁", d.name, folderPath(d.parent).map(z => z.name).join(" › ") || "Bibliothèque")).join("")}${S.files.map(f => row("f:" + f.id, kindIcon(fileKind(f.name, f.type)), f.name, folderPath(f.folder).map(z => z.name).join(" › ") || "Bibliothèque")).join("") || ""}</div>`;
    body.querySelector(".pk-q").oninput = e => { const q = e.target.value.toLowerCase(); body.querySelectorAll(".pk").forEach(l => l.style.display = l.textContent.toLowerCase().includes(q) ? "" : "none"); };
    modal({ title: "Ajouter au chapitre « " + esc(plan.chapters.find(c => c.id === chId)?.title || "") + " »", body, buttons: [{ label: "Annuler", value: null }, { label: "Ajouter", primary: true, act: () => {
      const sel = [...body.querySelectorAll("input:checked:not(:disabled)")].map(i => { const [k, id] = i.value.split(":"); return { k, id }; });
      if (sel.length) { add(sel, chId); collapsed.delete(chId); changed(); toast(`${sel.length} élément(s) ajouté(s)`); }
    } }] });
  };
  draw();
  return { draw };
}
