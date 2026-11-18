// Espace professeur : coque (menu latéral), navigation et compte.
import { $, $$, esc, ui, cleanLesson } from "./core.js";
import { confirmDlg, toast, modal, passwordBox, installCard } from "./ui.js";
import { DEMO } from "./fb.js";
import { S, reload, fail, api, normPlan, sName, initials, pickStudents, syncAccess } from "./adm-state.js";
import { lessonsView, editLesson } from "./adm-lessons.js";
import { libraryView } from "./adm-library.js";
import { studentsView, studentDetail, templatesView, templateEdit, dashboardView } from "./adm-students.js";

const NAV = [["home", "🏠", "Accueil"], ["students", "👥", "Élèves"], ["templates", "🧭", "Parcours types"], ["lessons", "🎓", "Leçons"], ["library", "🗂️", "Bibliothèque"], ["account", "⚙️", "Compte"]];
const VIEWS = { home: dashboardView, students: studentsView, student: studentDetail, templates: templatesView, template: templateEdit, lessons: lessonsView, lesson: editLesson, library: libraryView, account: accountView };
const SECTION = { student: "students", template: "templates", lesson: "lessons" };
let guardFn = null, current = "home";

export async function startAdmin(ctx, view = "home", ...args) {
  S.C = { ...ctx, go, guard: fn => guardFn = fn, restart: (v, ...a) => startAdmin(ctx, v, ...a) };
  document.body.classList.add("admin");
  $("#nav").className = "side";
  $("#nav").innerHTML = `<div class="brand"><span class="flag"></span>Paso a paso</div>` + NAV.map(([k, i, t]) => `<button data-nav="${k}"><b>${i}</b><span>${t}</span></button>`).join("") + (DEMO ? `<div class="demo-tag">🧪 Mode démo</div>` : "");
  $$("#nav [data-nav]").forEach(b => b.onclick = () => go(b.dataset.nav));
  $("#hdr-right").innerHTML = `<span class="pill">👩‍🏫 ${esc(ctx.profile.name || "Professeur")}</span>`;
  ui.m.innerHTML = `<p class="mute center">Chargement…</p>`;
  try { await reload(); } catch (e) { fail(e); }
  guardFn = null;
  go(view, ...args);
}
async function go(v, ...args) {
  if (guardFn && !(await guardFn())) return;
  guardFn = null; document.onkeydown = null;
  document.querySelectorAll(".ctx,.ov").forEach(e => e.remove());
  current = v;
  $$("#nav [data-nav]").forEach(b => b.classList.toggle("on", b.dataset.nav === (SECTION[v] || v)));
  try { VIEWS[v](...args); } catch (e) { fail(e); }
}
window.addEventListener("beforeunload", e => { if (guardFn) { e.preventDefault(); e.returnValue = ""; } });

/* ---------- compte ---------- */
function accountView() {
  ui.setTitle("⚙️ Mon compte");
  const C = S.C;
  ui.m.innerHTML = `<div class="card"><b>${esc(C.profile.name || "Professeur")}</b><div class="mute">${esc(C.user.email)}</div></div>
  ${DEMO ? `<div class="demo"><b>🧪 Mode démo.</b> Tout est stocké dans ce navigateur. Pour passer en vrai mode, suivez le README (configuration Firebase).<p><button class="btn ghost small" id="dreset">Réinitialiser la démo</button></p></div>` : ""}
  <div class="card" id="admins"></div>
  <div class="card" id="instcard"></div>
  <div class="card" id="pwbox"></div>
  <div class="card" id="bkp"><b>💾 Sauvegarde complète</b>
    <p class="mute">Un fichier qui contient <b>tout</b> : leçons, parcours types, élèves, parcours de chaque élève (chapitres, états, documents attribués), vos notes et exercices perso, leurs résultats, et l'arborescence de la bibliothèque. À faire régulièrement, et à garder en lieu sûr (il contient les noms et e-mails de vos élèves).</p>
    <label class="swl" style="margin:4px 0 10px"><span class="sw"><input type="checkbox" id="bk_files"><span></span></span>Inclure aussi les fichiers de la bibliothèque (PDF, Word…) — fichier plus lourd</label>
    <div class="row tight"><button class="btn" id="exp">⬇️ Télécharger la sauvegarde complète</button><button class="btn ghost" id="impb">⬆️ Restaurer une sauvegarde</button><input type="file" id="impf" accept=".json" hidden></div>
    <div id="bk_msg" class="mute" style="margin-top:8px"></div></div>
  <button class="btn ghost full" id="out">Se déconnecter</button>`;
  installCard($("#instcard"));
  passwordBox($("#pwbox"), async pw => { try { await C.api.changePassword(pw); toast("Mot de passe changé ✓"); return true; } catch (e) { fail(e); return false; } });
  $("#exp").onclick = () => backup($("#bk_files").checked).catch(fail);
  $("#impb").onclick = () => $("#impf").click();
  $("#impf").onchange = e => { const f = e.target.files[0]; e.target.value = ""; if (f) restore(f).catch(fail); };
  $("#out").onclick = () => C.api.logout();
  drawAdmins();
  const dr = $("#dreset"); if (dr) dr.onclick = async () => { if (await confirmDlg("Effacer toutes les données de démo ?", { ok: "Effacer", danger: true })) { await C.api.reset(); location.reload(); } };
}

/* ---------- administrateurs ---------- */
function drawAdmins() {
  const box = $("#admins"), me = S.C.user.uid;
  box.innerHTML = `<b>👩‍🏫 Administrateurs</b><p class="mute">Les administrateurs ont tous les mêmes droits que vous : leçons, bibliothèque, élèves, parcours. Vous travaillez sur les mêmes données, comme dans une même école.</p>
    ${S.admins.map(a => `<div class="vrow row" style="align-items:center"><span class="row tight" style="align-items:center"><span class="av">${esc(initials(a))}</span><span><b>${esc(sName(a))}</b>${a.id === me ? ' <span class="tag OK">vous</span>' : ""}<br><small class="mute">${esc(a.email)}</small></span></span>
      <span class="row tight" style="flex:none">${a.id === me ? "" : `<button class="btn ghost small" data-demote="${a.id}">Retirer les droits</button>`}</span></div>`).join("")}
    <p class="row tight"><button class="btn small" id="ad_inv">✉️ Inviter un administrateur</button><button class="btn ghost small" id="ad_pro">⬆️ Passer un élève administrateur</button></p>`;
  $("#ad_inv").onclick = inviteAdmin;
  $("#ad_pro").onclick = promote;
  box.querySelectorAll("[data-demote]").forEach(b => b.onclick = () => demote(b.dataset.demote));
}
async function inviteAdmin() {
  const body = document.createElement("div");
  body.innerHTML = `<label class="f">Prénom et nom</label><input type="text" id="a_n" placeholder="Ana García">
    <label class="f">Adresse e-mail</label><input type="email" id="a_m" placeholder="adresse@email.com">
    <p class="mute">${DEMO ? "<b>Mode démo :</b> aucun e-mail n'est envoyé." : "Il reçoit un e-mail pour choisir son mot de passe, puis se connecte et arrive directement dans l'espace professeur."}</p>`;
  const r = await modal({ title: "✉️ Inviter un administrateur", body, buttons: [{ label: "Annuler", value: null }, { label: "Envoyer l'invitation", primary: true, act: () => {
    const name = body.querySelector("#a_n").value.trim(), email = body.querySelector("#a_m").value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast("Adresse e-mail invalide."); return false; }
    return { name, email };
  } }] }).result;
  if (!r) return;
  try {
    toast("Envoi…", 1500);
    const uid = await api().createStudent(r.email);
    const doc = { email: r.email, name: r.name, role: "admin", createdAt: Date.now(), invitedAt: Date.now() };
    await api().set("users/" + uid, doc, false);
    S.admins.push({ id: uid, ...doc });
    toast(DEMO ? "Administrateur créé (démo : pas d'e-mail)" : `Invitation envoyée à ${r.email} ✓`, 3500);
    drawAdmins();
  } catch (e) {
    if (e.code === "auth/email-already-in-use") toast("Ce compte existe déjà. Si c'est un élève, utilisez « Passer un élève administrateur ».", 6000);
    else fail(e);
  }
}
async function promote() {
  const ids = await pickStudents({ title: "⬆️ Passer administrateur", intro: "Cochez le ou les élèves qui deviennent administrateurs. Ils quitteront la liste des élèves (leur progression est conservée).", ok: "Passer administrateur" });
  if (!ids?.length) return;
  if (!await confirmDlg(`Donner tous les droits d'administrateur à ${ids.length} personne(s) ?`, { ok: "Confirmer" })) return;
  try {
    for (const id of ids) {
      await api().set("users/" + id, { role: "admin" });
      const s = S.students.find(x => x.id === id);
      S.students = S.students.filter(x => x.id !== id);
      if (s) S.admins.push({ ...s, role: "admin" });
    }
    toast("Droits d'administrateur accordés ✓"); drawAdmins();
  } catch (e) { fail(e); }
}
async function demote(id) {
  const a = S.admins.find(x => x.id === id); if (!a) return;
  if (!await confirmDlg(`Retirer les droits d'administrateur à ${esc(sName(a))} ?<br><br>Son compte devient un compte élève (avec un parcours vide).`, { ok: "Retirer les droits", danger: true })) return;
  try {
    await api().set("users/" + id, { role: "student" });
    if (!S.plans[id]) { const p = normPlan(); await api().replace("plans/" + id, p); S.plans[id] = p; }
    S.admins = S.admins.filter(x => x.id !== id);
    S.students.push({ ...a, role: "student" });
    toast("Droits retirés ✓"); drawAdmins();
  } catch (e) { fail(e); }
}

/* ---------- sauvegarde complète ---------- */
const msg = t => { const m = $("#bk_msg"); if (m) m.textContent = t; };
async function backup(withFiles) {
  const btn = $("#exp"); btn.disabled = true;
  try {
    msg("Préparation de la sauvegarde…");
    await reload();
    const a = S.C.api;
    const users = await a.list("users");
    const data = {
      app: "paso-a-paso", v: 3, date: new Date().toISOString(), withFiles: !!withFiles,
      order: S.order, lessons: S.lessons, templates: S.templates,
      users, plans: Object.entries(S.plans).map(([id, p]) => ({ id, ...p })), progress: Object.entries(S.progress).map(([id, p]) => ({ id, ...p })),
      folders: S.folders, files: S.files, fileData: {},
    };
    if (withFiles) {
      let i = 0;
      for (const f of S.files) {
        msg(`Fichiers : ${++i} / ${S.files.length} (${f.name})`);
        const parts = await Promise.all(Array.from({ length: f.chunks || 0 }, (_, k) => a.get(`files/${f.id}/chunks/${k}`)));
        data.fileData[f.id] = parts.map(p => p?.d || "");
      }
    }
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const el = document.createElement("a"); el.href = URL.createObjectURL(blob);
    el.download = `paso-a-paso-sauvegarde${withFiles ? "-avec-fichiers" : ""}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(el.href), 60000);
    const mo = (blob.size / 1048576).toFixed(1).replace(".", ",");
    S.lastBackup = Date.now(); a.set("settings/main", { lastBackup: S.lastBackup }).catch(() => {});
    msg(`✓ Sauvegarde téléchargée (${mo} Mo) : ${S.lessons.length} leçons, ${S.students.length} élèves, ${S.folders.length} dossiers, ${S.files.length} fichiers${withFiles ? " (avec leur contenu)" : " (sans leur contenu)"}.`);
    toast("Sauvegarde téléchargée ✓");
  } finally { btn.disabled = false; }
}
async function restore(file) {
  const d = JSON.parse(await file.text());
  if (d.app !== "paso-a-paso" || !Array.isArray(d.lessons)) throw new Error("Ce fichier n'est pas une sauvegarde Paso a paso.");
  const me = S.C.user.uid, users = (d.users || []).filter(u => u.id !== me);
  const filesOk = (d.files || []).filter(f => d.fileData?.[f.id] || S.files.some(x => x.id === f.id));
  const body = document.createElement("div");
  body.innerHTML = `<p>Sauvegarde du <b>${new Date(d.date).toLocaleString("fr-BE")}</b>. Que voulez-vous restaurer ?</p>
    <label class="pk"><input type="checkbox" value="lessons" checked><span><b>Leçons et parcours types</b><br><small class="mute">${d.lessons.length} leçon(s), ${(d.templates || []).length} parcours type(s)</small></span></label>
    ${d.users ? `<label class="pk"><input type="checkbox" value="students" checked><span><b>Élèves, parcours, notes et résultats</b><br><small class="mute">${users.filter(u => u.role !== "admin").length} élève(s). Les comptes de connexion doivent encore exister ; sinon, réinvitez l'élève.</small></span></label>` : ""}
    ${d.folders ? `<label class="pk"><input type="checkbox" value="library" checked><span><b>Bibliothèque</b><br><small class="mute">${d.folders.length} dossier(s), ${filesOk.length} fichier(s)${d.withFiles ? "" : " (sauvegarde sans contenu : seuls les fichiers encore présents sont replacés)"}</small></span></label>` : ""}
    <p class="mute">Les éléments de même identifiant sont remplacés par leur version sauvegardée. Rien d'autre n'est supprimé.</p>`;
  const what = await modal({ title: "⬆️ Restaurer une sauvegarde", body, buttons: [{ label: "Annuler", value: null }, { label: "Restaurer", primary: true, act: () => [...body.querySelectorAll("input:checked")].map(i => i.value) }] }).result;
  if (!what || !what.length) return;
  const a = S.C.api, strip = o => { const { id, ...rest } = o; return rest; };
  if (what.includes("lessons")) {
    msg("Restauration des leçons…");
    for (const l of d.lessons) await a.set("lessons/" + l.id, { ...cleanLesson(strip(l)), createdAt: l.createdAt || Date.now(), updatedAt: Date.now() }, false);
    for (const t of d.templates || []) await a.set("templates/" + t.id, { name: t.name, chapters: t.chapters || [], state: t.state || {} }, false);
    if (Array.isArray(d.order)) await a.set("settings/main", { order: d.order });
  }
  if (what.includes("library")) {
    for (const f of d.folders || []) await a.set("folders/" + f.id, strip(f), false);
    let i = 0;
    for (const f of filesOk) {
      msg(`Bibliothèque : ${++i} / ${filesOk.length} (${f.name})`);
      const parts = d.fileData?.[f.id];
      if (parts) for (let k = 0; k < parts.length; k++) await a.set(`files/${f.id}/chunks/${k}`, { d: parts[k] }, false);
      await a.set("files/" + f.id, { ...strip(f), chunks: parts ? parts.length : f.chunks }, false);
    }
  }
  if (what.includes("students")) {
    msg("Restauration des élèves…");
    for (const u of users) await a.set("users/" + u.id, strip(u), false);
    for (const p of d.plans || []) if (p.id !== me) await a.replace("plans/" + p.id, strip(p));
    for (const p of d.progress || []) if (p.id !== me) await a.replace("progress/" + p.id, strip(p));
  }
  await reload(); await syncAccess();
  msg("✓ Sauvegarde restaurée.");
  toast("Sauvegarde restaurée ✓", 3000); go("home");
}
