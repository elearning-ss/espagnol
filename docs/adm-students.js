// Élèves (liste, invitation, fiche, parcours, suivi) et parcours types.
import { $, $$, esc, ui, fmtDate, buildPath, pathLessons, ikey, newId, typeName, hwStatus, isoDay, fmtDue } from "./core.js";
import { modal, confirmDlg, promptDlg, choiceDlg, menu, toast, fileDrop } from "./ui.js";
import { S, api, fail, clone, normPlan, savePlan, syncAccess, lib, studentById, sName, initials, pickStudents } from "./adm-state.js";
import { pathBuilder } from "./adm-path.js";
import { DEMO } from "./fb.js";
import { startStudent } from "./student.js";
import { tempPassword, sendInviteDialog } from "./invite.js";
import { purgeSocial, assignTopic, unreadCount, toCorrect, rulesBox } from "./adm-social.js";
import { unreadFor } from "./social.js";
import { fileKind, kindIcon, parseVocabText, uploadFile, fmtSize, MAX_FILE, previewFile } from "./files.js";

/* ---------- statistiques ---------- */
export function stats(s) {
  const plan = S.plans[s.id] || normPlan(), pr = S.progress[s.id] || {};
  const P = buildPath(plan, lib(), pr), L = pathLessons(P);
  const passed = L.filter(i => i.passed).length, open = L.filter(i => i.unlocked).length;
  const att = Object.values(pr.attempts || {}).reduce((a, b) => a + b.length, 0);
  const docs = P.reduce((a, c) => a + c.items.filter(i => i.k !== "l" && i.visible).length, 0);
  return { P, L, passed, open, total: L.length, last: pr.last, att, docs };
}
const av = (s, cls = "") => `<span class="av ${cls}">${esc(initials(s))}</span>`;
const daysAgo = t => t ? Math.floor((Date.now() - t) / 864e5) : null;

/* =================== LISTE =================== */
export function studentsView() {
  ui.setTitle("👥 Élèves");
  const sel = new Set();
  ui.m.innerHTML = `<div class="row tight" style="align-items:center;margin-bottom:12px"><button class="btn" id="inv">✉️ Inviter un élève</button><input type="search" id="sq" placeholder="🔎 Rechercher" style="max-width:260px"><span style="flex:1"></span>
    <span class="bulk hide" id="bulk"><span id="bn"></span> <button class="btn ghost small" id="b_tpl">🧭 Appliquer un parcours type</button></span></div>
    ${S.students.length ? `<div class="cards" id="sl">${S.students.map(s => { const st = stats(s), d = daysAgo(st.last);
      return `<div class="scard ${s.disabled ? "off" : ""}" data-st="${s.id}"><input type="checkbox" class="ck2" data-ck="${s.id}" title="Sélectionner">
        <div class="row tight" style="align-items:center">${av(s, "lg")}<div style="min-width:0"><b>${esc(sName(s))}</b><div class="mute ell">${esc(s.email)}</div></div></div>
        <div class="minibar" style="margin:10px 0 4px"><i style="width:${st.total ? st.passed / st.total * 100 : 0}%"></i></div>
        <div class="mute" style="font-size:13px">${st.passed}/${st.total} leçons réussies · ${st.docs} doc. · ${st.att} série${st.att > 1 ? "s" : ""}</div>
        <div style="font-size:13px;margin-top:4px">${s.disabled ? '<span class="tag D">désactivé</span>' : !st.last ? '<span class="tag T">jamais connecté</span>' : d > 10 ? `<span class="tag G">inactif depuis ${d} j</span>` : `<span class="tag OK">actif ${d === 0 ? "aujourd'hui" : `il y a ${d} j`}</span>`} ${S.plans[s.id]?.mode === "auto" ? '<span class="tag D">auto</span>' : ""}</div></div>`; }).join("")}</div>`
      : `<div class="card center"><div class="big">🎓</div><p>Pas encore d'élève.</p><p class="mute">Invitez votre premier élève : il recevra un e-mail pour choisir son mot de passe.</p></div>`}`;
  $("#inv").onclick = invite;
  const sq = $("#sq"); sq.oninput = () => { const q = sq.value.toLowerCase(); $$(".scard").forEach(c => c.style.display = c.textContent.toLowerCase().includes(q) ? "" : "none"); };
  const upd = () => { $("#bulk").classList.toggle("hide", !sel.size); $("#bn").textContent = `${sel.size} sélectionné(s)`; };
  $$(".scard").forEach(c => c.onclick = e => { if (e.target.classList.contains("ck2")) { e.target.checked ? sel.add(c.dataset.st) : sel.delete(c.dataset.st); c.classList.toggle("sel", e.target.checked); return upd(); } S.C.go("student", c.dataset.st); });
  const bt = $("#b_tpl"); if (bt) bt.onclick = () => applyTemplateTo([...sel]);
}
async function invite() {
  const body = document.createElement("div");
  body.innerHTML = `<label class="f">Prénom et nom</label><input type="text" id="i_n" placeholder="Lucía Martin">
    <label class="f">Adresse e-mail</label><input type="email" id="i_m" placeholder="adresse@email.com">
    <label class="f">Parcours de départ</label><select id="i_t"><option value="">Vide (je le construis moi-même)</option>${S.templates.map((t, i) => `<option value="${t.id}" ${i === 0 ? "selected" : ""}>🧭 ${esc(t.name)}</option>`).join("")}</select>
    <p class="mute">Le compte est créé avec un mot de passe provisoire. Vous envoyez ensuite l'invitation <b>depuis votre propre messagerie</b> (message tout prêt).</p>`;
  const r = await modal({ title: "✉️ Inviter un élève", body, buttons: [{ label: "Annuler", value: null }, { label: "Créer le compte", primary: true, act: () => {
    const name = body.querySelector("#i_n").value.trim(), email = body.querySelector("#i_m").value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast("Adresse e-mail invalide."); return false; }
    return { name, email, tpl: body.querySelector("#i_t").value };
  } }] }).result;
  if (!r) return;
  try {
    toast("Création du compte…", 1500);
    const pw = tempPassword(), uid = await api().createStudent(r.email, pw);
    const doc = { email: r.email, name: r.name, role: "student", createdAt: Date.now(), invitedAt: Date.now(), mustChange: true, tempPw: pw };
    await api().set("users/" + uid, doc, false);
    S.students.push({ id: uid, ...doc });
    const t = S.templates.find(x => x.id === r.tpl);
    const plan = normPlan(t ? { chapters: freshChapters(t.chapters), state: clone(t.state || {}) } : {});
    await savePlan(uid, plan);
    await sendInviteDialog({ name: r.name, email: r.email, pw, teacher: S.signature || "Stéphanie", role: "student" });
    S.C.go("student", uid);
  } catch (e) {
    if (e.code === "auth/email-already-in-use") toast("Un compte existe déjà avec cet e-mail. Ouvrez la fiche de l'élève et utilisez « Renvoyer l'invitation ».", 6000);
    else fail(e);
  }
}
const freshChapters = ch => clone(ch).map(c => ({ ...c, id: newId() }));
// Renvoyer : même mot de passe provisoire s'il n'a pas encore choisi le sien ; sinon, lien « mot de passe oublié »
export async function resendInvite(s) {
  if (s.mustChange && s.tempPw) return sendInviteDialog({ name: s.name, email: s.email, pw: s.tempPw, teacher: S.signature || "Stéphanie", role: s.role, again: true });
  const c = await choiceDlg("✉️ Renvoyer l'invitation", `<b>${esc(sName(s))}</b> a déjà choisi son mot de passe. S'il l'a oublié, le plus simple est qu'il clique sur « Mot de passe oublié ? » sur la page de connexion.`,
    [{ label: "Envoyer le mail de réinitialisation", value: "fb" }]);
  if (c === "fb") { try { await api().resetPassword(s.email); toast(DEMO ? "(démo : pas d'e-mail)" : "E-mail envoyé ✓"); } catch (e) { fail(e); } }
}

/* =================== FICHE ÉLÈVE =================== */
export function studentDetail(uid, tab = "path") {
  const s = studentById(uid); if (!s) return S.C.go("students");
  const P = clone(S.plans[uid] || normPlan());
  const pr = S.progress[uid] || {};
  let dirty = false;
  const mark = () => { dirty = true; const b = $("#psave"); if (b) { b.disabled = false; b.textContent = "💾 Enregistrer"; $("#pundo").classList.remove("hide"); } };
  S.C.guard(async () => !dirty || await confirmDlg("Les modifications du parcours ne sont pas enregistrées. Quitter quand même ?", { ok: "Quitter sans enregistrer", danger: true }));
  const save = async () => {
    const b = $("#psave"); b.disabled = true; b.textContent = "Enregistrement…";
    try { await savePlan(uid, P); dirty = false; b.textContent = "✓ Enregistré"; $("#pundo").classList.add("hide"); toast("Parcours enregistré ✓"); }
    catch (e) { fail(e); b.disabled = false; b.textContent = "💾 Enregistrer"; }
  };
  document.onkeydown = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (dirty) save(); } };

  const render = () => {
    const st = stats({ ...s, id: uid });
    ui.setTitle(`🎓 ${esc(sName(s))}`, () => S.C.go("students"));
    ui.m.innerHTML = `<div class="card shead"><div class="row tight" style="align-items:center">${av(s, "xl")}<div style="flex:1;min-width:200px"><h2 style="margin:0">${esc(sName(s))}</h2><div class="mute">${esc(s.email)}${s.disabled ? ' · <span class="tag D">désactivé</span>' : ""}</div></div>
        <button class="btn ghost small" id="s_msg">💬 Écrire${unreadFor(S.threads?.[uid], "t") ? ` <span class="nbi">•</span>` : ""}</button><button class="btn ghost small" id="s_prev">👁️ Voir comme l'élève</button><button class="ib" id="s_more" title="Plus d'actions">⋯</button></div>
      <div class="kpi" style="margin:12px 0 0"><div><b>${st.passed}/${st.total}</b><span class="mute">leçons réussies</span></div><div><b>${st.open}</b><span class="mute">leçons ouvertes</span></div><div><b>${st.docs}</b><span class="mute">documents</span></div><div><b>${st.att}</b><span class="mute">séries d'exercices</span></div><div><b style="font-size:15px">${fmtDate(st.last)}</b><span class="mute">dernière activité</span></div></div></div>
    <div class="tabs"><button data-t="path" class="${tab === "path" ? "on" : ""}">🧭 Parcours</button><button data-t="track" class="${tab === "track" ? "on" : ""}">📊 Suivi</button><button data-t="hw" class="${tab === "hw" ? "on" : ""}">📌 Devoirs${pendingHw() ? ` <span class="nbi">${pendingHw()}</span>` : ""}</button><button data-t="prep" class="${tab === "prep" ? "on" : ""}">🗒️ Séance</button><button data-t="voc" class="${tab === "voc" ? "on" : ""}">📒 Vocabulaire</button><button data-t="set" class="${tab === "set" ? "on" : ""}">⚙️ Réglages</button></div>
    <div id="pane"></div>
    <div class="sticky-save"><span class="mute" style="margin-right:auto">${P.mode === "auto" ? "Déblocage automatique" : "Déblocage manuel"} · Ctrl+S pour enregistrer</span><button class="btn ghost hide" id="pundo">↩️ Annuler les modifications</button><button class="btn" id="psave" ${dirty ? "" : "disabled"}>${dirty ? "💾 Enregistrer" : "✓ Enregistré"}</button></div>`;
    if (dirty) $("#pundo").classList.remove("hide");
    $$("[data-t]").forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
    $("#psave").onclick = save;
    $("#pundo").onclick = async () => { if (await confirmDlg("Revenir au dernier parcours enregistré ?", { ok: "Annuler mes modifications" })) { dirty = false; S.C.guard(null); studentDetail(uid, tab); } };
    $("#s_msg").onclick = () => S.C.go("messages", uid);
    $("#s_prev").onclick = () => {
      startStudent({ api: api(), user: { uid }, profile: s, lessons: S.lessons.filter(l => l.published), files: S.files, folders: S.folders, plan: clone(P), progress: clone(pr), preview: true,
        onExit: () => S.C.restart("student", uid) });
    };
    $("#s_more").onclick = () => { const r = $("#s_more").getBoundingClientRect(); menu(r.right - 260, r.bottom + 4, [
      { icon: "🧭", label: "Appliquer un parcours type…", act: () => applyTemplateHere() },
      { icon: "👯", label: "Copier le parcours d'un autre élève…", act: () => copyFrom() },
      { icon: "💾", label: "Enregistrer comme parcours type…", act: () => saveAsTemplate(P) },
      { icon: "✍️", label: "Donner un sujet de rédaction…", act: () => assignTopic([uid]) },
      "-",
      { icon: "✉️", label: "Renvoyer l'invitation", act: () => resendInvite(s) },
      { icon: s.disabled ? "▶️" : "⏸️", label: s.disabled ? "Réactiver le compte" : "Désactiver le compte", act: async () => { try { s.disabled = !s.disabled; await api().set("users/" + uid, { disabled: s.disabled }); await syncAccess(); render(); } catch (e) { fail(e); } } },
      { icon: "🗑️", label: "Supprimer l'élève", danger: true, act: async () => {
        if (!await confirmDlg(`Supprimer ${esc(sName(s))} et <b>toutes</b> ses données : parcours, progression, messages et rédactions ?<br><br><small class="mute">Pour supprimer aussi son identifiant de connexion : console Firebase › Authentication.</small>`, { ok: "Supprimer", danger: true })) return;
        try { await purgeSocial(uid); await Promise.all(["users/", "plans/", "progress/"].map(p => api().del(p + uid))); S.students = S.students.filter(x => x.id !== uid); delete S.plans[uid]; await syncAccess(); dirty = false; S.C.guard(null); S.C.go("students"); toast("Élève supprimé"); } catch (e) { fail(e); }
      } },
    ]); };
    const pane = $("#pane");
    if (tab === "path") {
      if (!P.chapters.length) pane.insertAdjacentHTML("beforeend", `<div class="note" style="margin-bottom:10px">Ce parcours est vide. ${S.templates.length ? `<button class="btn small" id="qtpl">🧭 Partir d'un parcours type</button>` : ""} ou glissez des leçons et documents depuis le panneau de gauche.</div>`);
      const q = $("#qtpl"); if (q) q.onclick = applyTemplateHere;
      const holder = document.createElement("div"); pane.appendChild(holder);
      pathBuilder(holder, P, { kind: "student", uid, progress: pr, onChange: mark, onTestBack: () => S.C.restart("student", uid) });
    }
    if (tab === "track") track(pane);
    if (tab === "voc") vocTab(pane);
    if (tab === "hw") hwTab(pane);
    if (tab === "prep") prepTab(pane);
    if (tab === "set") settings(pane);
  };

  function track(p) {
    const Pth = buildPath(P, lib(), pr);
    const rows = Pth.flatMap(c => c.items.filter(i => i.k === "l" && i.obj).map(i => ({ c, i })));
    const recent = Object.entries(pr.attempts || {}).flatMap(([id, a]) => a.map(x => ({ id, ...x }))).sort((a, b) => b.at - a.at).slice(0, 12);
    p.innerHTML = `<div class="card"><b>Résultats par leçon</b><div class="scroll"><table class="tlist"><thead><tr><th>Leçon</th><th>État</th><th>Meilleur</th><th>Essais</th><th>Historique</th><th>Dernier essai</th></tr></thead><tbody>
      ${rows.map(({ c, i }) => { const at = pr.attempts?.[i.id] || []; return `<tr><td>${esc(i.obj.emoji)} ${esc(i.obj.title)}<br><small class="mute">${esc(c.title)}</small></td><td>${i.state === "hidden" ? "🙈 cachée" : i.unlocked ? "🔓 ouverte" : "🔒 verrouillée"}</td><td>${i.score ? `<b style="color:${i.passed ? "var(--ok)" : "var(--r)"}">${i.score} %</b>` : "—"}</td><td>${at.length || ""}</td><td>${spark(at)}</td><td>${at.length ? fmtDate(at[at.length - 1].at) : "—"}</td></tr>`; }).join("") || `<tr><td colspan="6" class="mute">Aucune leçon dans le parcours.</td></tr>`}</tbody></table></div></div>
      <div class="card"><b>Activité récente</b>${recent.map(r => { const l = S.lessons.find(x => x.id === r.id); return `<div class="vrow">${fmtDate(r.at)} · ${l ? esc(l.emoji + " " + l.title) : "Leçon supprimée"} · <b>${r.pct} %</b></div>`; }).join("") || `<p class="mute">Pas encore d'activité.</p>`}</div>
      <div class="card"><b>Documents accessibles</b>${S.files.filter(f => (f.students || []).includes(uid)).map(f => `<div class="vrow">${kindIcon(fileKind(f.name, f.type))} ${esc(f.name)}</div>`).join("") || `<p class="mute">Aucun document. Glissez-en depuis la bibliothèque dans son parcours.</p>`}</div>`;
  }
  /* ---------- devoirs ---------- */
  const HL = () => ({ lessons: S.lessons, files: S.files });
  const pendingHw = () => (P.homework || []).filter(h => !hwStatus(h, HL(), pr).done).length;
  function hwCard(h, { edit = true } = {}) {
    const st = hwStatus(h, HL(), pr);
    return `<div class="card hw ${st.done ? "ok" : st.late ? "late" : ""}"><div class="hw-h"><b>${esc(h.title || "Devoir")}</b><span class="when">${st.done ? "✓ terminé" : `${esc(st.when)} · ${st.nd}/${st.n}`}</span>
      ${edit ? `<span class="row tight" style="flex:none"><button class="ib" data-hwe="${h.id}" title="Modifier">✏️</button><button class="ib" data-hwd="${h.id}" title="Supprimer">🗑️</button></span>` : ""}</div>
      ${h.note ? `<div class="mute" style="white-space:pre-wrap">${esc(h.note)}</div>` : ""}
      ${st.items.map(it => `<div class="hw-it ${it.done ? "done" : ""}" style="cursor:default"><span class="ck">${it.done ? "✓" : ""}</span><span class="lb">${esc(it.label)}</span></div>`).join("")}
      ${(() => { const R = (S.returns?.[uid] || []).filter(r => r.hw === h.id); return R.length ? `<div class="hw-ret"><b style="width:100%">📤 Copie rendue :</b>${R.map(r => `<span class="rchip" data-rv="${r.id}">${kindIcon(fileKind(r.name, r.type))} ${esc(r.name)} <small class="mute">${fmtDate(r.createdAt)}</small>${r.seenT ? "" : ` <span class="badge">nouveau</span>`}</span>`).join("")}</div>` : ""; })()}
      <small class="mute">Donné le ${fmtDate(h.at)}${h.due ? ` · à faire pour ${esc(fmtDue(h.due))}` : ""}</small></div>`;
  }
  function hwTab(p) {
    P.homework = P.homework || [];
    const L = P.homework.map(h => ({ h, st: hwStatus(h, HL(), pr) })).sort((a, b) => (a.st.done - b.st.done) || String(b.h.due).localeCompare(String(a.h.due)));
    p.innerHTML = rulesBox("returns") + `<div class="card row tight" style="align-items:center"><div style="flex:1"><b>📌 Devoirs de ${esc(sName(s))}</b><div class="mute">Ils s'affichent en haut de son espace avec la date. Leçons, documents et révision se cochent tout seuls quand il les fait.</div></div><button class="btn" id="hw_new">+ Donner un devoir</button></div>
      ${L.map(x => hwCard(x.h)).join("") || `<div class="card center mute">Aucun devoir pour l'instant.</div>`}`;
    $("#hw_new").onclick = () => hwEdit();
    $$("[data-rv]", p).forEach(b => b.onclick = async () => {
      const r = (S.returns[uid] || []).find(x => x.id === b.dataset.rv); if (!r) return;
      previewFile(api(), r);
      if (!r.seenT) { r.seenT = Date.now(); try { await api().set(`${r.base}/${r.id}`, { seenT: r.seenT }); } catch (e) {} render(); }
    });
    $$("[data-hwe]", p).forEach(b => b.onclick = () => hwEdit(P.homework.find(h => h.id === b.dataset.hwe)));
    $$("[data-hwd]", p).forEach(b => b.onclick = async () => { if (!await confirmDlg("Supprimer ce devoir ?", { ok: "Supprimer", danger: true })) return; P.homework = P.homework.filter(h => h.id !== b.dataset.hwd); mark(); await save(); render(); });
  }
  async function hwEdit(h0, preset) {
    const isNew = !h0, h = h0 ? clone(h0) : { id: newId(), title: "", due: isoDay(new Date(Date.now() + 7 * 864e5)), note: "", items: preset || [] };
    const Pth = buildPath(P, lib(), pr), ls = pathLessons(Pth);
    const fids = new Set(Pth.flatMap(c => c.items.filter(i => i.k === "f" && i.obj).map(i => i.id)));
    S.files.forEach(f => { if ((f.students || []).includes(uid)) fids.add(f.id); });
    const fs = S.files.filter(f => fids.has(f.id)).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const has = (k, id) => h.items.some(i => i.k === k && (id === undefined || i.id === id));
    const free = h.items.filter(i => i.k === "t").map(i => i.txt).join("\n");
    const body = `<label class="f">Titre</label><input type="text" id="hw_t" value="${esc(h.title)}" placeholder="ex. Pour jeudi">
      <div class="grid2"><div><label class="f">À faire pour le</label><input type="date" id="hw_d" value="${esc(h.due || "")}"></div><div></div></div>
      <label class="f">Mot pour l'élève (facultatif)</label><textarea id="hw_n" rows="2" placeholder="ex. Concentre-toi sur les verbes irréguliers.">${esc(h.note || "")}</textarea>
      <label class="f">Leçons à travailler <small class="mute">(faites quand l'exercice est réussi)</small></label>
      <div class="hwpick">${ls.map(i => `<label><input type="checkbox" data-hl="${i.id}" ${has("l", i.id) ? "checked" : ""}> ${esc(i.obj.emoji)} ${esc(i.obj.title)} ${i.unlocked ? "" : `<small class="mute">(sera ouverte)</small>`}${i.score ? ` <small class="mute">· ${i.score} %</small>` : ""}</label>`).join("") || `<p class="mute">Aucune leçon dans son parcours.</p>`}</div>
      <label class="f">Documents <small class="mute">(faits quand il les ouvre)</small></label>
      <div class="hwdrop" id="hw_drop" tabindex="0"><b>📎 Déposer un devoir tout fait</b><span class="mute">Glissez ici un fichier (Word, PDF, image, audio…) ou cliquez pour le choisir · ${fmtSize(MAX_FILE)} max.</span><input type="file" id="hw_file" multiple hidden></div>
      <div class="hwpick" id="hw_docs"></div>
      <label class="hwr"><input type="checkbox" id="hw_r" ${has("r") ? "checked" : ""}> 🃏 Faire une séance de révision du vocabulaire</label>
      <label class="hwr"><input type="checkbox" id="hw_u" ${has("u") ? "checked" : ""}> 📤 Me rendre sa copie (photo de sa feuille ou fichier)</label>
      <label class="f">Autres consignes <small class="mute">(une par ligne, l'élève les coche lui-même)</small></label><textarea id="hw_x" rows="3" placeholder="ex. Écrire 5 phrases sur ton week-end&#10;Regarder un épisode en espagnol">${esc(free)}</textarea>`;
    // documents proposés : ceux auxquels l'élève a accès, ceux déjà dans le devoir, ceux qu'on vient de déposer ; « toute la bibliothèque » sur demande
    const picked = new Set(h.items.filter(i => i.k === "f").map(i => i.id));
    let showAll = false;
    const drawDocs = B => {
      const box = $("#hw_docs", B); if (!box) return;
      $$("[data-hf]", box).forEach(e => e.checked ? picked.add(e.dataset.hf) : picked.delete(e.dataset.hf));
      const shown = S.files.filter(f => showAll || fids.has(f.id) || picked.has(f.id)).sort((a, b) => (picked.has(b.id) - picked.has(a.id)) || a.name.localeCompare(b.name, "fr"));
      const more = S.files.length - shown.length;
      box.innerHTML = shown.map(f => `<label><input type="checkbox" data-hf="${f.id}" ${picked.has(f.id) ? "checked" : ""}> ${kindIcon(fileKind(f.name, f.type))} ${esc(f.name)}${fids.has(f.id) ? "" : ` <small class="mute">(lui sera donné)</small>`}</label>`).join("") || `<p class="mute">Aucun document pour l'instant.</p>`;
      if (more > 0) { box.insertAdjacentHTML("beforeend", `<button type="button" class="btn ghost small" id="hw_all">📂 Choisir dans toute la bibliothèque (${more} autre${more > 1 ? "s" : ""})</button>`); $("#hw_all", box).onclick = () => { showAll = true; drawDocs(B); }; }
    };
    const upload = async (files, B) => {
      let folder = S.folders.find(d => !d.parent && d.name === "Devoirs");
      try {
        if (!folder) { const fid = api().newId("folders"); folder = { id: fid, name: "Devoirs", parent: null, students: [], createdAt: Date.now(), updatedAt: Date.now() }; const { id: _, ...doc } = folder; await api().set("folders/" + fid, doc, false); S.folders.push(folder); }
        for (const file of files) {
          toast(`Envoi de « ${file.name} »…`, 60000);
          const doc = await uploadFile(api(), file, { folder: folder.id, students: [] }, pr => toast(`Envoi de « ${file.name} » : ${Math.round(pr * 100)} %`, 60000));
          S.files.push(doc); drawDocs(B); picked.add(doc.id); drawDocs(B);
        }
        toast(files.length > 1 ? `${files.length} documents ajoutés ✓` : "Document ajouté au devoir ✓");
      } catch (e) { fail(e); }
    };
    const r = await modal({ title: isNew ? "📌 Nouveau devoir" : "📌 Modifier le devoir", wide: true, body,
      onOpen: a => {
        const B = a.body, z = $("#hw_drop", B), inp = $("#hw_file", B);
        drawDocs(B);
        z.onclick = () => inp.click(); z.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inp.click(); } };
        inp.onchange = () => { const f = [...inp.files]; inp.value = ""; if (f.length) upload(f, B); };
        fileDrop(z, f => upload(f, B));
      },
      buttons: [{ label: "Annuler", value: null }, { label: isNew ? "Donner le devoir" : "Enregistrer", primary: true, act: a => {
      const B = a.body, items = [
        ...$$("[data-hl]:checked", B).map(e => ({ k: "l", id: e.dataset.hl })),
        ...(drawDocs(B), [...picked].filter(id => S.files.some(f => f.id === id)).map(id => ({ k: "f", id }))),
        ...($("#hw_r", B).checked ? [{ k: "r" }] : []),
        ...($("#hw_u", B).checked ? [{ k: "u" }] : []),
        ...$("#hw_x", B).value.split("\n").map(x => x.trim()).filter(Boolean).map(txt => ({ k: "t", txt })),
      ];
      if (!items.length) { toast("Choisissez au moins une chose à faire."); return false; }
      return { title: $("#hw_t", B).value.trim() || "Devoir", due: $("#hw_d", B).value, note: $("#hw_n", B).value.trim(), items };
    } }] }).result;
    if (!r) return;
    // les consignes cochées par l'élève restent cochées si leur texte n'a pas changé : on ne touche pas aux autres
    Object.assign(h, r); if (isNew) h.at = Date.now();
    P.homework = P.homework || [];
    if (isNew) P.homework.push(h); else P.homework[P.homework.findIndex(x => x.id === h.id)] = h;
    // une leçon donnée en devoir doit être accessible
    let opened = 0;
    for (const c of buildPath(P, lib(), pr)) for (const i of c.items) if (i.k === "l" && !i.unlocked && h.items.some(x => x.k === "l" && x.id === i.id)) { P.state[i.key] = "open"; opened++; }
    mark(); await save(); if (opened) toast(`Devoir donné ✓ · ${opened} leçon(s) ouverte(s) pour l'occasion`);
    tab = "hw"; render();
  }

  /* ---------- préparation de séance ---------- */
  function prepTab(p) {
    const since = P.lastSession || Date.now() - 7 * 864e5, sinceTxt = P.lastSession ? `depuis la dernière séance (${fmtDate(P.lastSession)})` : "sur les 7 derniers jours";
    const Pth = buildPath(P, lib(), pr), ls = pathLessons(Pth);
    const att = Object.entries(pr.attempts || {}).flatMap(([id, a]) => a.map(x => ({ id, ...x }))).filter(a => a.at >= since).sort((a, b) => a.at - b.at);
    const opened = Object.entries(pr.opened || {}).filter(([, t]) => t >= since).map(([id]) => S.files.find(f => f.id === id)).filter(Boolean);
    const weak = [...(pr.weak || [])].sort((a, b) => (b.n || 1) - (a.n || 1) || b.at - a.at);
    const struggling = ls.filter(i => i.unlocked && i.score && !i.passed);
    const hw = (P.homework || []).map(h => ({ h, st: hwStatus(h, HL(), pr) })).filter(x => !x.st.done || (x.h.due && x.h.due >= isoDay(new Date(since))));
    const byL = {}; att.forEach(a => (byL[a.id] = byL[a.id] || []).push(a.pct));
    const nextL = ls.find(i => !i.unlocked);
    p.innerHTML = `<div class="card row tight noprint" style="align-items:center"><div style="flex:1"><b>🗒️ Préparer la séance avec ${esc(sName(s))}</b><div class="mute">Ce qu'il a fait ${sinceTxt}, ses difficultés et ses devoirs, sur une page.</div></div>
        <button class="btn ghost" id="pp_print">🖨️ Imprimer</button><button class="btn" id="pp_done">✅ Séance faite aujourd'hui</button></div>
      <div class="prep">
      <div class="card"><h3>📈 Activité ${sinceTxt}</h3>
        ${Object.keys(byL).length ? Object.entries(byL).map(([id, v]) => { const l = S.lessons.find(x => x.id === id); return `<div class="vrow">${l ? esc(l.emoji + " " + l.title) : "Leçon supprimée"} · ${v.length} essai${v.length > 1 ? "s" : ""} : ${v.map(x => `<b style="color:${x >= (l?.passScore ?? 70) ? "var(--ok)" : "var(--r)"}">${x} %</b>`).join(" → ")}</div>`; }).join("") : `<p class="mute">Aucun exercice fait sur la période.</p>`}
        ${opened.length ? `<div class="vrow">📄 Documents ouverts : ${opened.map(f => esc(f.name)).join(", ")}</div>` : ""}
        ${(pr.revAt || 0) >= since ? `<div class="vrow">🃏 Dernière révision du vocabulaire : ${fmtDate(pr.revAt)}</div>` : ""}
        <div class="vrow mute">Dernière connexion : ${fmtDate(pr.last)}</div></div>
      <div class="card"><h3>📌 Devoirs</h3>${hw.length ? hw.map(({ h, st }) => `<div class="vrow"><b>${esc(h.title)}</b> · ${st.done ? `<span style="color:var(--ok)">✓ fait</span>` : `<span style="color:${st.late ? "var(--r)" : "inherit"}">${st.nd}/${st.n} · ${esc(st.when)}</span>`}${st.done ? "" : `<br><small class="mute">Reste : ${st.items.filter(i => !i.done).map(i => esc(i.label)).join(" · ")}</small>`}</div>`).join("") : `<p class="mute">Aucun devoir en cours.</p>`}
        <p class="noprint"><button class="btn ghost small" id="pp_hw">+ Donner un devoir</button></p></div>
      <div class="card"><h3>🎯 À retravailler</h3>
        ${struggling.length ? `<p><b>Leçons pas encore réussies :</b> ${struggling.map(i => `${esc(i.obj.title)} (${i.score} %)`).join(", ")}</p>` : ""}
        ${weak.length ? `<p><b>Erreurs fréquentes en exercice :</b></p>${weak.slice(0, 12).map(w => `<div class="vrow"><b>${esc(w.it)}</b> — ${esc(w.fr)}${(w.n || 1) > 1 ? ` <span class="tag D">×${w.n}</span>` : ""}</div>`).join("")}
          <p class="noprint"><button class="btn ghost small" id="pp_rev">📌 Donner ces erreurs en révision</button></p>` : ""}
        ${!struggling.length && !weak.length ? `<p class="mute">Rien de particulier : tout est réussi. 👏</p>` : ""}</div>
      <div class="card"><h3>➡️ Pour la suite</h3>
        ${nextL ? `<p>Prochaine leçon du parcours : <b>${esc(nextL.obj.emoji)} ${esc(nextL.obj.title)}</b> ${nextL.state === "hidden" ? "(cachée)" : "(verrouillée)"}</p><p class="noprint"><button class="btn ghost small" id="pp_open">🔓 L'ouvrir maintenant</button></p>` : `<p class="mute">Toutes les leçons du parcours sont ouvertes.</p>`}
        <label class="f">Mes notes pour la séance <small class="mute">(gardées sur cet ordinateur uniquement, jamais visibles par l'élève)</small></label><textarea id="pp_notes" rows="5" placeholder="ex. Revoir ser/estar, lui parler du DELE…"></textarea></div>
      </div>`;
    const NK = "paso_prep_" + uid; try { $("#pp_notes").value = localStorage.getItem(NK) || ""; } catch (e) {}
    $("#pp_notes").oninput = e => { try { localStorage.setItem(NK, e.target.value); } catch (x) {} };
    $("#pp_print").onclick = () => window.print();
    $("#pp_done").onclick = async () => { P.lastSession = Date.now(); mark(); await save(); toast("Séance notée ✓ : la prochaine préparation partira d'aujourd'hui."); render(); };
    $("#pp_hw").onclick = () => hwEdit();
    const rv = $("#pp_rev"); if (rv) rv.onclick = () => hwEdit(null, [{ k: "r" }]).then(() => {});
    const op = $("#pp_open"); if (op) op.onclick = async () => { P.state[nextL.key] = "open"; mark(); await save(); render(); };
  }

  function vocTab(p) {
    P.vocab = Array.isArray(P.vocab) ? P.vocab : [];
    const mine = (pr.myVocab || []).filter(v => v && v[0]), weak = pr.weak || [];
    p.innerHTML = `<div class="card"><b>📒 Mots ajoutés par vous pour ${esc(sName(s))}</b><p class="mute" style="margin:4px 0 8px">Ils apparaissent dans son carnet et dans ses révisions. Idéal pour les mots vus en séance.</p>
      <div class="list" id="pv">${P.vocab.map((v, i) => `<div class="item" style="gap:6px"><div class="grid3" style="flex:1"><input type="text" data-pv="${i}|0" value="${esc(v[0])}" placeholder="Espagnol"><input type="text" data-pv="${i}|1" value="${esc(v[1])}" placeholder="Français"><input type="text" data-pv="${i}|2" value="${esc(v[2] || "")}" placeholder="Prononciation"><button class="ib" data-pvdel="${i}" title="Supprimer">🗑️</button></div></div>`).join("") || '<p class="mute">Aucun mot pour l\'instant.</p>'}</div>
      <p class="row tight"><button class="btn small" id="pv_add">+ Ajouter un mot</button></p>
      <details><summary>📋 Coller une liste (Excel, Word, « mot ; traduction »…)</summary><textarea id="pv_paste" placeholder="la playa ; la plage&#10;el coche = la voiture" style="margin-top:8px"></textarea><p><button class="btn ghost small" id="pv_imp">Ajouter ces mots</button></p></details></div>
      <div class="card"><b>🎯 Ses mots ratés en exercice</b> <span class="mute">(${weak.length})</span>${weak.length ? `<div class="scroll"><table class="tlist"><thead><tr><th>Espagnol</th><th>Français / contexte</th><th>Erreurs</th><th>Dernière fois</th></tr></thead><tbody>${weak.slice(0, 40).map(w => `<tr><td><b>${esc(w.it)}</b></td><td>${esc(w.fr)}</td><td>${w.n || 1}</td><td>${fmtDate(w.at)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="mute">Aucune erreur en attente : ses erreurs disparaissent d'ici quand il les maîtrise en révision.</p>`}</div>
      <div class="card"><b>✍️ Son propre carnet</b> <span class="mute">(${mine.length})</span>${mine.length ? mine.map(v => `<div class="vrow"><b>${esc(v[0])}</b> — ${esc(v[1])}</div>`).join("") : `<p class="mute">Il n'a pas encore ajouté de mots lui-même.</p>`}</div>`;
    $$("[data-pv]", p).forEach(e => e.oninput = () => { const [i, k] = e.dataset.pv.split("|"); P.vocab[+i][+k] = e.value; mark(); });
    $$("[data-pvdel]", p).forEach(b => b.onclick = () => { P.vocab.splice(+b.dataset.pvdel, 1); mark(); vocTab(p); });
    $("#pv_add").onclick = () => { P.vocab.push(["", "", ""]); mark(); vocTab(p); const ins = $$('[data-pv$="|0"]', p); ins[ins.length - 1]?.focus(); };
    $("#pv_imp").onclick = () => { const r = parseVocabText($("#pv_paste").value).rows; if (!r.length) return toast("Aucun mot reconnu."); P.vocab.push(...r); mark(); vocTab(p); toast(`${r.length} mot(s) ajouté(s). Pensez à enregistrer.`); };
  }
  function settings(p) {
    p.innerHTML = `<div class="card"><b>🔒 Confidentialité</b><p class="mute" style="margin:4px 0 0">${s.consentAt ? `Politique acceptée le ${fmtDate(s.consentAt)}.` : "Pas encore acceptée : ce sera demandé à sa première connexion."} Pour une demande d'effacement : menu ⋯ › Supprimer l'élève (efface aussi ses messages et rédactions).</p></div>`;
    p.innerHTML += `<div class="card"><label class="f">Nom de l'élève</label><div class="row"><input type="text" id="s_name" value="${esc(s.name || "")}"><button class="btn ghost" id="s_nsave" style="flex:none">Enregistrer le nom</button></div></div>
      <div class="card"><b>Déblocage des leçons</b>
      <p><label><input type="radio" name="mode" value="manual" ${P.mode !== "auto" ? "checked" : ""}> <b>Manuel</b> : je débloque chaque leçon moi-même (🔓), au fil des cours.</label><br>
      <label><input type="radio" name="mode" value="auto" ${P.mode === "auto" ? "checked" : ""}> <b>Automatique</b> : la leçon suivante s'ouvre quand l'élève réussit la précédente. Les leçons 🙈 cachées restent cachées.</label></p></div>
      <div class="card"><b>💬 Message pour l'élève</b><p class="mute">Affiché en haut de son espace.</p><textarea id="s_msg" placeholder="ex. Bravo pour ta progression ! Pour jeudi, révise le chapitre 2.">${esc(P.message || "")}</textarea></div>`;
    $("#s_nsave").onclick = async () => { try { s.name = $("#s_name").value.trim(); await api().set("users/" + uid, { name: s.name }); toast("Nom enregistré"); render(); } catch (e) { fail(e); } };
    $$("[name=mode]").forEach(r => r.onchange = () => { P.mode = r.value; mark(); });
    $("#s_msg").oninput = e => { P.message = e.target.value; mark(); };
  }
  async function applyTemplateHere() {
    const r = await chooseTemplate(P.chapters.length > 0); if (!r) return;
    applyTpl(P, r.t, r.how); mark(); tab = "path"; render(); toast("Parcours type appliqué. Pensez à enregistrer.");
  }
  async function copyFrom() {
    const others = S.students.filter(x => x.id !== uid && S.plans[x.id]?.chapters.length);
    if (!others.length) return toast("Aucun autre élève n'a de parcours.");
    const id = await modal({ title: "👯 Copier le parcours de…", body: `<select id="cf">${others.map(o => `<option value="${o.id}">${esc(sName(o))} (${S.plans[o.id].chapters.length} chapitres)</option>`).join("")}</select><p class="mute">Le parcours actuel sera remplacé (les scores ne sont pas copiés).</p>`, buttons: [{ label: "Annuler", value: null }, { label: "Copier", primary: true, act: a => a.body.querySelector("#cf").value }] }).result;
    if (!id) return;
    const src = S.plans[id]; P.chapters = freshChapters(src.chapters); P.state = clone(src.state); mark(); tab = "path"; render();
  }
  render();
}
const spark = at => { if (!at.length) return ""; const v = at.slice(-10); return `<span class="spark">${v.map(a => `<i style="height:${Math.max(8, a.pct)}%;background:${a.pct >= 70 ? "var(--ok)" : "var(--o)"}" title="${a.pct} % · ${fmtDate(a.at)}"></i>`).join("")}</span>`; };

/* =================== PARCOURS TYPES =================== */
async function chooseTemplate(hasContent) {
  if (!S.templates.length) { toast("Aucun parcours type : créez-en un dans 🧭 Parcours types."); return null; }
  const body = document.createElement("div");
  body.innerHTML = `<label class="f">Parcours type</label><select id="ct">${S.templates.map(t => `<option value="${t.id}">${esc(t.name)} — ${t.chapters.length} chapitres</option>`).join("")}</select>
    ${hasContent ? `<label class="f">Le parcours actuel n'est pas vide</label><label><input type="radio" name="how" value="append" checked> Ajouter les chapitres à la suite</label><br><label><input type="radio" name="how" value="replace"> Remplacer tout le parcours</label>` : ""}`;
  return modal({ title: "🧭 Appliquer un parcours type", body, buttons: [{ label: "Annuler", value: null }, { label: "Appliquer", primary: true, act: () => ({ t: S.templates.find(x => x.id === body.querySelector("#ct").value), how: body.querySelector("[name=how]:checked")?.value || "replace" }) }] }).result;
}
function applyTpl(plan, t, how) {
  const ch = freshChapters(t.chapters);
  if (how === "replace") { plan.chapters = ch; plan.state = clone(t.state || {}); return; }
  const has = new Set(plan.chapters.flatMap(c => c.items.map(ikey)));
  ch.forEach(c => c.items = c.items.filter(i => !has.has(ikey(i))));
  plan.chapters.push(...ch.filter(c => c.items.length));
  Object.entries(t.state || {}).forEach(([k, v]) => { if (!plan.state[k]) plan.state[k] = v; });
}
async function applyTemplateTo(uids) {
  const r = await chooseTemplate(uids.some(u => S.plans[u]?.chapters.length)); if (!r) return;
  try {
    for (const u of uids) { const p = clone(S.plans[u] || normPlan()); applyTpl(p, r.t, r.how); await savePlan(u, p); }
    toast(`Parcours « ${r.t.name} » appliqué à ${uids.length} élève(s) ✓`, 3500); studentsView();
  } catch (e) { fail(e); }
}
async function saveAsTemplate(P) {
  const name = await promptDlg("Enregistrer comme parcours type", "Nouveau parcours type", { ok: "Enregistrer", label: "Nom du parcours type" }); if (!name) return;
  try { const id = api().newId("templates"); const t = { name, chapters: clone(P.chapters), state: clone(P.state), createdAt: Date.now() }; await api().set("templates/" + id, t, false); S.templates.push({ id, ...normPlan(t) }); toast("Parcours type enregistré ✓"); } catch (e) { fail(e); }
}

export function templatesView() {
  ui.setTitle("🧭 Parcours types");
  ui.m.innerHTML = `<p class="mute">Un parcours type est un modèle de chapitres (leçons + documents) que vous appliquez en un clic à un ou plusieurs élèves, puis que vous ajustez au cas par cas dans leur fiche.</p>
    <div class="row tight" style="margin-bottom:12px"><button class="btn" id="tnew">+ Nouveau parcours type</button></div>
    <div class="cards">${S.templates.map(t => { const n = t.chapters.reduce((a, c) => a + c.items.length, 0); return `<div class="scard" data-t="${t.id}"><div class="big" style="text-align:left;font-size:30px">🧭</div><b>${esc(t.name)}</b><div class="mute">${t.chapters.length} chapitre(s) · ${n} élément(s)</div>
      <div class="mute ell" style="font-size:13px;margin-top:6px">${t.chapters.map(c => esc(c.title)).join(" · ")}</div>
      <div class="row tight" style="margin-top:10px"><button class="btn small" data-ed="${t.id}">✏️ Modifier</button><button class="btn ghost small" data-ap="${t.id}">👥 Appliquer…</button><button class="ib" data-tm="${t.id}">⋯</button></div></div>`; }).join("") || `<div class="card mute">Aucun parcours type pour l'instant.</div>`}</div>`;
  $("#tnew").onclick = async () => { const name = await promptDlg("Nouveau parcours type", "Débutant", { ok: "Créer", label: "Nom" }); if (!name) return; try { const id = api().newId("templates"); const t = { name, chapters: [{ id: newId(), title: "Chapitre 1", items: [] }], state: {}, createdAt: Date.now() }; await api().set("templates/" + id, t, false); S.templates.push({ id, ...normPlan(t) }); templateEdit(id); } catch (e) { fail(e); } };
  $$("[data-ed]").forEach(b => b.onclick = e => { e.stopPropagation(); templateEdit(b.dataset.ed); });
  $$(".scard[data-t]").forEach(c => c.ondblclick = () => templateEdit(c.dataset.t));
  $$("[data-ap]").forEach(b => b.onclick = async e => { e.stopPropagation(); const t = S.templates.find(x => x.id === b.dataset.ap); const u = await pickStudents({ title: `Appliquer « ${esc(t.name)} »`, intro: "Choisissez les élèves. Vous pourrez ensuite ajuster le parcours de chacun.", ok: "Continuer" }); if (!u?.length) return;
    const how = u.some(x => S.plans[x]?.chapters.length) ? await choiceDlg("Parcours existants", "Certains élèves ont déjà un parcours.", [{ label: "Ajouter à la suite", value: "append" }, { label: "Remplacer", value: "replace" }]) : "replace"; if (!how) return;
    try { for (const x of u) { const p = clone(S.plans[x] || normPlan()); applyTpl(p, t, how); await savePlan(x, p); } toast(`Appliqué à ${u.length} élève(s) ✓`); } catch (er) { fail(er); } });
  $$("[data-tm]").forEach(b => b.onclick = e => { e.stopPropagation(); const t = S.templates.find(x => x.id === b.dataset.tm), r = b.getBoundingClientRect(); menu(r.right - 220, r.bottom + 4, [
    { icon: "✏️", label: "Renommer", act: async () => { const n = await promptDlg("Renommer", t.name); if (!n) return; t.name = n; await api().set("templates/" + t.id, { name: n }); templatesView(); } },
    { icon: "📄", label: "Dupliquer", act: async () => { const id = api().newId("templates"); const c = { name: t.name + " (copie)", chapters: freshChapters(t.chapters), state: clone(t.state), createdAt: Date.now() }; await api().set("templates/" + id, c, false); S.templates.push({ id, ...normPlan(c) }); templatesView(); } },
    "-", { icon: "🗑️", label: "Supprimer", danger: true, act: async () => { if (!await confirmDlg(`Supprimer le parcours type « ${esc(t.name)} » ?<br><small class="mute">Les parcours des élèves ne changent pas.</small>`, { ok: "Supprimer", danger: true })) return; await api().del("templates/" + t.id); S.templates = S.templates.filter(x => x !== t); templatesView(); } },
  ]); });
}
export function templateEdit(id) {
  const t = S.templates.find(x => x.id === id); if (!t) return S.C.go("templates");
  const W = clone(t); let dirty = false;
  const mark = () => { dirty = true; const b = $("#tsave"); if (b) { b.disabled = false; b.textContent = "💾 Enregistrer"; } };
  S.C.guard(async () => !dirty || await confirmDlg("Ce parcours type n'est pas enregistré. Quitter quand même ?", { ok: "Quitter sans enregistrer", danger: true }));
  ui.setTitle(`🧭 ${esc(W.name)}`, () => S.C.go("templates"));
  ui.m.innerHTML = `<div class="card row tight" style="align-items:center"><label class="f" style="margin:0">Nom</label><input type="text" id="tn" value="${esc(W.name)}" style="flex:1"></div><div id="tb"></div>
    <div class="sticky-save"><button class="btn ghost" id="tap">👥 Appliquer à des élèves…</button><button class="btn" id="tsave" disabled>✓ Enregistré</button></div>`;
  $("#tn").oninput = e => { W.name = e.target.value; mark(); };
  pathBuilder($("#tb"), W, { kind: "template", onChange: mark });
  const save = async () => { try { await api().set("templates/" + id, { name: W.name, chapters: W.chapters, state: W.state }); Object.assign(t, clone(W)); dirty = false; const b = $("#tsave"); b.disabled = true; b.textContent = "✓ Enregistré"; toast("Parcours type enregistré ✓"); } catch (e) { fail(e); } };
  $("#tsave").onclick = save;
  document.onkeydown = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (dirty) save(); } };
  $("#tap").onclick = async () => { if (dirty) await save(); const u = await pickStudents({ title: `Appliquer « ${esc(W.name)} »`, ok: "Continuer" }); if (!u?.length) return;
    const how = u.some(x => S.plans[x]?.chapters.length) ? await choiceDlg("Parcours existants", "Certains élèves ont déjà un parcours.", [{ label: "Ajouter à la suite", value: "append" }, { label: "Remplacer", value: "replace" }]) : "replace"; if (!how) return;
    try { for (const x of u) { const p = clone(S.plans[x] || normPlan()); applyTpl(p, t, how); await savePlan(x, p); } toast(`Appliqué à ${u.length} élève(s) ✓`); } catch (er) { fail(er); } };
}

/* =================== TABLEAU DE BORD =================== */
export function dashboardView() {
  ui.setTitle(`<span class="flag"></span>Tableau de bord`);
  const todo = [];
  for (const s of S.students) {
    if (s.disabled) continue;
    const st = stats(s), plan = S.plans[s.id];
    if (!plan?.chapters.length) { todo.push({ s, ic: "🧭", txt: "n'a pas encore de parcours", btn: "Construire son parcours", act: () => S.C.go("student", s.id) }); continue; }
    if (plan.mode !== "auto") {
      // a réussi toutes ses leçons ouvertes, et une leçon verrouillée attend
      const L = st.L, open = L.filter(i => i.unlocked), next = L.find(i => !i.unlocked && i.state === "locked");
      if (open.length && open.every(i => i.passed) && next) {
        const lastOk = open[open.length - 1];
        todo.push({ s, ic: "🎉", txt: `a réussi « ${esc(lastOk.obj.title)} » (${lastOk.score} %)`, btn: `🔓 Débloquer « ${esc(next.obj.title)} »`, act: async () => { const p = clone(plan); p.state[next.key] = "open"; try { await savePlan(s.id, p); toast("Leçon débloquée ✓"); dashboardView(); } catch (e) { fail(e); } } });
      }
    }
    const pr = S.progress[s.id] || {};
    for (const h of plan.homework || []) {
      const st = hwStatus(h, { lessons: S.lessons, files: S.files }, pr);
      const newR = (S.returns?.[s.id] || []).filter(r => r.hw === h.id && !r.seenT).length;
      if (newR) todo.unshift({ s, ic: "📤", txt: `a rendu sa copie pour « ${esc(h.title)} » (${newR} fichier${newR > 1 ? "s" : ""})`, btn: "Voir la copie", act: () => S.C.go("student", s.id, "hw") });
      if (st.late) todo.push({ s, ic: "⏰", txt: `n'a pas fini le devoir « ${esc(h.title)} » (${st.nd}/${st.n}, ${esc(st.when)})`, btn: "Voir ses devoirs", act: () => S.C.go("student", s.id, "hw") });
      else if (st.done && h.due && h.due >= isoDay(new Date(Date.now() - 3 * 864e5))) todo.push({ s, ic: "✅", txt: `a terminé le devoir « ${esc(h.title)} »`, btn: "Préparer la séance", act: () => S.C.go("student", s.id, "prep") });
    }
    const lastAtt = Object.entries(pr.attempts || {}).flatMap(([id, a]) => a.map(x => ({ id, ...x }))).sort((a, b) => b.at - a.at)[0];
    if (lastAtt && lastAtt.pct < 50 && Date.now() - lastAtt.at < 14 * 864e5) { const l = S.lessons.find(x => x.id === lastAtt.id); if (l) todo.push({ s, ic: "🆘", txt: `a eu ${lastAtt.pct} % à « ${esc(l.title)} »`, btn: "Ajouter une note / un exercice", act: () => S.C.go("student", s.id) }); }
    const d = daysAgo(st.last);
    if (!st.last && s.createdAt && Date.now() - s.createdAt > 3 * 864e5) todo.push({ s, ic: "✉️", txt: "ne s'est jamais connecté", btn: "Renvoyer l'invitation", act: () => resendInvite(s) });
    else if (d > 10) todo.push({ s, ic: "💤", txt: `inactif depuis ${d} jours`, btn: "Écrire un message", act: () => S.C.go("messages", s.id) });
    const th = S.threads?.[s.id];
    if (unreadFor(th, "t")) todo.unshift({ s, ic: /suppression/i.test(th.lastText || "") ? "🗑️" : "💬", txt: `vous a écrit : « ${esc((th.lastText || "").slice(0, 70))} »`, btn: "Répondre", act: () => S.C.go("messages", s.id) });
    for (const w of (S.writings?.[s.id] || []).filter(w => w.status === "sent")) todo.unshift({ s, ic: "✍️", txt: `a envoyé une rédaction : « ${esc(w.title)} »`, btn: "Corriger", act: () => S.C.go("correct", s.id, w.id) });
  }
  const recent = S.students.flatMap(s => Object.entries(S.progress[s.id]?.attempts || {}).flatMap(([id, a]) => a.map(x => ({ s, id, ...x })))).sort((a, b) => b.at - a.at).slice(0, 10);
  const week = recent.filter(r => Date.now() - r.at < 7 * 864e5).length;
  const bkDays = S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / 864e5) : null;
  const bkWarn = (S.students.length || S.files.length) && (bkDays === null || bkDays >= 14);
  ui.m.innerHTML = `${bkWarn ? `<div class="bkwarn"><span>💾 ${bkDays === null ? "Vous n'avez encore jamais fait de sauvegarde complète." : `Dernière sauvegarde complète il y a ${bkDays} jours.`} Pensez à en télécharger une, par sécurité.</span><button class="btn small" data-nav2="account">Faire une sauvegarde</button></div>` : ""}<div class="kpi"><div><b>${S.students.filter(s => !s.disabled).length}</b><span class="mute">élèves</span></div><div><b>${S.lessons.length}</b><span class="mute">leçons</span></div><div><b>${S.files.length}</b><span class="mute">documents</span></div><div><b>${S.templates.length}</b><span class="mute">parcours types</span></div><div><b>${week}</b><span class="mute">séries cette semaine</span></div></div>
    <div class="dash">
      <div class="card"><h3 style="margin-top:0">✅ À faire</h3>${todo.map((t, i) => `<div class="todo"><span class="tic">${t.ic}</span>${av(t.s)}<div class="t"><b class="lnk" data-go="${t.s.id}">${esc(sName(t.s))}</b> ${t.txt}</div><button class="btn small" data-todo="${i}">${t.btn}</button></div>`).join("") || `<p class="mute">Rien à signaler. ☀️</p>`}</div>
      <div class="card"><h3 style="margin-top:0">🕒 Activité récente</h3>${recent.map(r => { const l = S.lessons.find(x => x.id === r.id); return `<div class="vrow row tight" style="align-items:center">${av(r.s, "sm")}<span style="flex:1"><b class="lnk" data-go="${r.s.id}">${esc(sName(r.s))}</b> · ${l ? esc(l.emoji + " " + l.title) : "?"}<br><small class="mute">${fmtDate(r.at)}</small></span><b style="color:${r.pct >= 70 ? "var(--ok)" : "var(--r)"}">${r.pct} %</b></div>`; }).join("") || `<p class="mute">Pas encore d'activité.</p>`}</div>
    </div>
    <div class="card"><h3 style="margin-top:0">⚡ Raccourcis</h3><div class="row tight"><button class="btn ghost" data-nav2="students">✉️ Inviter un élève</button><button class="btn ghost" data-nav2="library">⬆️ Ajouter des supports</button><button class="btn ghost" data-nav2="lessons">🎓 Créer une leçon</button><button class="btn ghost" data-nav2="templates">🧭 Parcours types</button><button class="btn ghost" data-nav2="writings">✍️ Donner une rédaction</button></div></div>`;
  $$("[data-todo]").forEach(b => b.onclick = () => todo[+b.dataset.todo].act());
  $$("[data-go]").forEach(b => b.onclick = () => S.C.go("student", b.dataset.go));
  $$("[data-nav2]").forEach(b => b.onclick = () => S.C.go(b.dataset.nav2));
}
