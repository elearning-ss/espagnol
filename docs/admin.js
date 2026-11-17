// Espace professeur : coque (menu latéral), navigation et compte.
import { $, $$, esc, ui, cleanLesson } from "./core.js";
import { confirmDlg, toast, modal } from "./ui.js";
import { DEMO } from "./fb.js";
import { S, reload, fail, api, normPlan, sName, initials, pickStudents } from "./adm-state.js";
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
  <div class="card"><b>Changer mon mot de passe</b><input type="password" id="pw1" placeholder="Nouveau mot de passe (6 caractères min.)" style="margin-top:6px"><p><button class="btn ghost" id="svp">Changer</button></p></div>
  <div class="card"><b>💾 Sauvegarde des leçons et parcours types</b><p class="mute">Téléchargez vos leçons et parcours types dans un fichier (à faire de temps en temps). Les documents de la bibliothèque se sauvegardent en les téléchargeant.</p>
    <div class="row tight"><button class="btn ghost" id="exp">⬇️ Télécharger la sauvegarde</button><button class="btn ghost" id="impb">⬆️ Restaurer une sauvegarde</button><input type="file" id="impf" accept=".json" hidden></div></div>
  <button class="btn ghost full" id="out">Se déconnecter</button>`;
  $("#svp").onclick = async () => { const pw = $("#pw1").value; if (pw.length < 6) return toast("6 caractères minimum."); try { await C.api.changePassword(pw); $("#pw1").value = ""; toast("Mot de passe changé ✓"); } catch (e) { fail(e); } };
  $("#exp").onclick = () => {
    const data = { app: "paso-a-paso", v: 2, date: new Date().toISOString(), order: S.order, lessons: S.lessons, templates: S.templates };
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
    a.download = `paso-a-paso-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove();
  };
  $("#impb").onclick = () => $("#impf").click();
  $("#impf").onchange = async e => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try {
      const d = JSON.parse(await f.text()); if (!Array.isArray(d.lessons)) throw new Error("Fichier de sauvegarde invalide.");
      if (!await confirmDlg(`Restaurer ${d.lessons.length} leçon(s)${d.templates ? ` et ${d.templates.length} parcours type(s)` : ""} ? Les éléments de même identifiant seront remplacés.`, { ok: "Restaurer" })) return;
      for (const l of d.lessons) { const { id, ...rest } = l; await C.api.set("lessons/" + id, { ...cleanLesson(rest), updatedAt: Date.now() }, false); }
      for (const t of d.templates || []) { const { id, ...rest } = t; await C.api.set("templates/" + id, { name: rest.name, chapters: rest.chapters, state: rest.state || {} }, false); }
      if (Array.isArray(d.order)) await C.api.set("settings/main", { order: d.order });
      await reload(); toast("Sauvegarde restaurée ✓"); go("lessons");
    } catch (er) { fail(er); }
  };
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
