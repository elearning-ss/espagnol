// Démarrage : connexion, puis espace professeur ou espace élève selon le rôle.
import { fb, DEMO, authError } from "./fb.js";
import { ADMIN_EMAIL } from "./config.js";
import { $, $$, esc, ui, cleanLesson } from "./core.js";
import { startAdmin } from "./admin.js";
import { startStudent } from "./student.js";
import { SEED, DEFAULT_TEMPLATE } from "./seed.js";
import { uploadFile } from "./files.js";

$("#back").onclick = () => ui.backFn && ui.backFn();
let api;

(async () => {
  try { api = await fb(); }
  catch (e) { $("#m").innerHTML = `<div class="warn">Impossible de se connecter à Firebase : ${esc(e.message)}. Vérifiez votre connexion et le fichier config.js.</div>`; return; }
  if (DEMO) await demoData();
  api.onAuth(u => u ? enter(u) : loginScreen());
})();

function resetChrome() {
  $("#nav").className = "hide"; $("#nav").innerHTML = ""; $("#hdr-right").innerHTML = "";
  document.body.classList.remove("admin");
}

/* ---------- écran de connexion ---------- */
async function loginScreen(msg) {
  resetChrome();
  ui.setTitle(`<span class="flag"></span>Paso a paso`);
  let demo = "";
  if (DEMO) {
    const st = (await api.list("users")).filter(u => u.role !== "admin");
    demo = `<div class="demo"><b>🧪 Mode démo</b> (Firebase pas encore configuré). Les données restent dans ce navigateur.<p class="row tight" style="margin:8px 0 0"><button class="btn small" data-demo="prof@demo">Entrer comme professeur</button>${st.map(s => `<button class="btn ghost small" data-demo="${esc(s.email)}">Élève : ${esc(s.name || s.email)}</button>`).join("")}</p></div>`;
  }
  ui.m.innerHTML = `<div class="login">${demo}<div class="card"><div class="center"><div class="big">🇪🇸</div><h2 style="margin:0">Paso a paso</h2><p class="mute">L'espagnol pas à pas</p></div>
    ${msg ? `<div class="warn">${esc(msg)}</div>` : ""}
    <label class="f">E-mail</label><input type="email" id="le" autocomplete="username">
    <label class="f">Mot de passe</label><input type="password" id="lp" autocomplete="current-password">
    <p><button class="btn full" id="lb">Se connecter</button></p>
    <p class="center"><a href="#" id="lf" class="mute">Mot de passe oublié ?</a></p>
    <p class="mute center" style="font-size:13px">Pas encore de compte ? Votre professeur vous envoie une invitation par e-mail.</p></div></div>`;
  const go = async () => {
    const b = $("#lb"); b.disabled = true;
    try { await api.login($("#le").value.trim(), $("#lp").value); }
    catch (e) { b.disabled = false; ui.toast(authError(e), 4000); }
  };
  $("#lb").onclick = go; $("#lp").onkeydown = e => { if (e.key === "Enter") go(); };
  $("#lf").onclick = async e => {
    e.preventDefault(); const em = $("#le").value.trim();
    if (!em) return ui.toast("Tapez d'abord votre e-mail ci-dessus.");
    try { await api.resetPassword(em); ui.toast("Si ce compte existe, un e-mail vient d'être envoyé ✓", 4000); } catch (er) { ui.toast(authError(er)); }
  };
  $$("[data-demo]").forEach(b => b.onclick = () => api.login(b.dataset.demo, "demo"));
}

/* ---------- entrée après connexion ---------- */
async function enter(u) {
  resetChrome();
  ui.m.innerHTML = `<p class="mute center" style="margin-top:20vh">Chargement…</p>`;
  try {
    let profile = await api.get("users/" + u.uid);
    const isTeacher = (u.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase() || (DEMO && u.uid === "admin");
    if (!profile && isTeacher) {
      profile = { email: u.email, name: "Professeur", role: "admin", createdAt: Date.now() };
      await api.set("users/" + u.uid, profile, false);
    }
    if (!profile) { await api.logout(); return loginScreen("Ce compte n'est pas reconnu. Demandez une invitation à votre professeur."); }
    if (profile.role === "admin") return startAdmin({ api, user: u, profile });
    if (profile.disabled) { await api.logout(); return loginScreen("Votre accès est suspendu. Contactez votre professeur."); }
    const [ls, plan, progress, files, folders] = await Promise.all([api.list("lessons"), api.get("plans/" + u.uid), api.get("progress/" + u.uid), api.listContains("files", "students", u.uid), api.listContains("folders", "students", u.uid)]);
    startStudent({ api, user: u, profile, lessons: ls.map(l => ({ id: l.id, ...cleanLesson(l) })).filter(l => l.published), files, folders, plan: plan || {}, progress: progress || {} });
  } catch (e) {
    console.error(e);
    ui.m.innerHTML = `<div class="warn">Erreur au chargement : ${esc(authError(e))}</div><button class="btn ghost" id="lo">Se déconnecter</button>`;
    $("#lo").onclick = () => api.logout();
  }
}

/* ---------- données de démonstration (mode démo uniquement) ---------- */
async function demoData() {
  if (await api.get("settings/demo")) return;
  for (const s of SEED) await api.set("lessons/" + s.id, { ...cleanLesson(s), createdAt: Date.now(), updatedAt: Date.now() }, false);
  await api.set("settings/main", { order: SEED.map(s => s.id) });
  await api.set("templates/t_debutant", { ...DEFAULT_TEMPLATE, createdAt: Date.now() }, false);
  const now = Date.now(), day = 864e5;
  // Bibliothèque : quelques dossiers et fichiers d'exemple
  const fold = async (id, name, parent, students = []) => api.set("folders/" + id, { name, parent, students, createdAt: now, updatedAt: now }, false);
  await fold("d_gram", "Grammaire", null, ["u_lucia"]); await fold("d_verbes", "Verbes", "d_gram", ["u_lucia"]); await fold("d_audio", "Écoutes", null); await fold("d_cult", "Culture", null);
  const mk = async (name, type, text, folder, students = []) => { const f = await uploadFile(api, new File([text], name, { type }), { folder, students }); return f.id; };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#c60b1e"/><rect y="100" width="600" height="200" fill="#ffc400"/><text x="300" y="215" font-size="42" text-anchor="middle" font-family="sans-serif" fill="#8a221c">¡Bienvenidos a España!</text></svg>`;
  const f1 = await mk("Ser ou estar - fiche.txt", "text/plain", "SER : identité, origine, métier, caractère.\nSoy francés. Es profesora. Es simpático.\n\nESTAR : lieu et état passager.\nEstoy en casa. Está cansada. Estamos contentos.", "d_gram", ["u_lucia"]);
  await mk("Verbes irréguliers au présent.txt", "text/plain", "ir : voy, vas, va, vamos, vais, van\nhacer : hago, haces, hace, hacemos, hacéis, hacen\ntener : tengo, tienes, tiene, tenemos, tenéis, tienen", "d_verbes", ["u_lucia"]);
  const f3 = await mk("Bienvenidos.svg", "image/svg+xml", svg, "d_cult");
  await mk("Vocabulaire du restaurant.txt", "text/plain", "la carta : le menu\nla cuenta : l'addition\nel camarero : le serveur\n¿Me trae la cuenta, por favor?", null);
  // Élèves
  const ch = (t, ids) => ({ id: Math.random().toString(36).slice(2, 8), title: t, items: ids.map(x => ({ k: x[0], id: x.slice(2) })) });
  await api.set("users/u_lucia", { email: "lucia@demo", name: "Lucía Martin", role: "student", createdAt: now - 20 * day });
  await api.set("plans/u_lucia", { mode: "manual", message: "¡Hola Lucía! Très bon début. Pour jeudi : leçon 3, exercices.",
    chapters: [ch("Chapitre 1 · Premiers pas", ["l:alfabeto", "l:presentarse", "l:presente", "f:" + f1]), ch("Chapitre 2 · Moi et les autres", ["l:numeros", "l:familia", "l:gustar"]), ch("📎 Documents", ["d:d_gram"])],
    state: { "l:alfabeto": "open", "l:presentarse": "open", "l:presente": "open", "l:gustar": "hidden" },
    notes: { presente: "Concentre-toi sur ser / estar, on en reparle jeudi." },
    extra: { presente: [{ t: "q", q: "« Je suis à la maison » :", o: ["Estoy en casa.", "Soy en casa.", "Tengo en casa.", "Es en casa."], x: "Lieu → estar." }] } });
  await api.set("progress/u_lucia", { done: { alfabeto: 88, presentarse: 78 }, attempts: { alfabeto: [{ pct: 63, at: now - 9 * day }, { pct: 88, at: now - 8 * day }], presentarse: [{ pct: 78, at: now - 2 * day }] }, xp: 260, cards: {}, seen: { alfabeto: 1, presentarse: 1, presente: 1 }, last: now - 2 * day });
  await api.set("users/u_tom", { email: "thomas@demo", name: "Thomas Dubois", role: "student", createdAt: now - 3 * day });
  await api.set("plans/u_tom", { mode: "auto", message: "", notes: {}, extra: {}, state: { "l:presentarse": "open" }, chapters: [ch("Pour commencer", ["l:presentarse", "l:alfabeto", "l:presente"]), ch("Culture", ["f:" + f3])] });
  await api.set("files/" + f3, { students: ["u_tom"] });
  await api.set("settings/demo", { at: now });
}
