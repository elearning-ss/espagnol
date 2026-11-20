// Espace professeur : messagerie, rédactions à corriger, confidentialité.
import { $, $$, esc, ui, fmtTime, fmtDate, textToHtml, safeHtml } from "./core.js";
import { modal, confirmDlg, promptDlg, toast } from "./ui.js";
import { S, api, fail, studentById, sName, initials, pickStudents } from "./adm-state.js";
import { chatBox, stopPoll, unreadFor, rulesHint, loadWritings, W_STATUS, wordCount, correctionHtml, bindMarks } from "./social.js";
import { loadPrivacy, privacyHtml, DEFAULT_PRIVACY } from "./privacy.js";
import { deleteFile } from "./files.js";

const av = (s, cls = "") => `<span class="av ${cls}">${esc(initials(s))}</span>`;

/* Données sociales : chargées avec le reste ; si les règles Firebase ne sont pas encore à jour, on le signale sans bloquer. */
export async function reloadSocial() {
  S.socialErr = null; S.errs = {};
  try { const T = await api().list("threads"); S.threads = Object.fromEntries(T.map(t => [t.id, t])); }
  catch (e) { S.threads = {}; S.errs.threads = e; }
  S.writings = {}; S.returns = {};
  try { await Promise.all(S.students.map(async s => { const b = `returns/${s.id}/items`; S.returns[s.id] = (await api().list(b)).map(r => ({ ...r, base: b })); })); }
  catch (e) { S.errs.returns = e; }
  try { await Promise.all(S.students.map(async s => { S.writings[s.id] = await loadWritings(api(), s.id); })); }
  catch (e) { S.errs.writings = e; }
}
export const unreadCount = () => S.students.filter(s => unreadFor(S.threads?.[s.id], "t")).length;
export const toCorrect = () => S.students.flatMap(s => (S.writings?.[s.id] || []).filter(w => w.status === "sent").map(w => ({ s, w })));
export function socialBadges() {
  const set = (k, n) => { const b = $(`#nav [data-nav="${k}"]`); if (!b) return; b.querySelector(".nb")?.remove(); if (n) b.insertAdjacentHTML("beforeend", `<span class="nb">${n}</span>`); };
  set("messages", unreadCount()); set("writings", toCorrect().length);
}
const WHAT = { threads: "la messagerie", writings: "les rédactions", returns: "les copies rendues par les élèves" };
export const rulesBox = (...keys) => {
  const k = keys.filter(x => S.errs?.[x]); if (!k.length) return "";
  return `<div class="warn">Les règles de sécurité Firebase ne permettent pas encore ${k.map(x => WHAT[x]).join(", ")}.<br><small>Console Firebase › Firestore Database › Règles : collez le texte complet du dernier fichier <b>firestore.rules</b>, puis « Publier ». Attendez une minute et actualisez la page.</small></div>`;
};

/* =================== MESSAGES =================== */
export function messagesView(uid) {
  ui.setTitle("💬 Messages");
  const act = S.students.filter(s => !s.disabled);
  const list = [...act].sort((a, b) => (S.threads[b.id]?.lastAt || 0) - (S.threads[a.id]?.lastAt || 0));
  if (!uid && matchMedia("(min-width: 900px)").matches) uid = list.find(s => S.threads[s.id])?.id || list[0]?.id;
  const cur = uid && studentById(uid);
  ui.m.innerHTML = rulesBox("threads") + (act.length ? `<div class="inbox ${cur ? "has" : ""}">
    <div class="card ib-l">${list.map(s => { const th = S.threads[s.id], un = unreadFor(th, "t"); return `<button class="ib-row ${s.id === uid ? "on" : ""} ${un ? "un" : ""}" data-u="${s.id}">${av(s, "sm")}<span class="t"><b>${esc(sName(s))}</b><small class="mute">${th ? `${th.lastFrom === "t" ? "Vous : " : ""}${esc(th.lastText || "")}` : "Pas encore de message"}</small></span>${th ? `<small class="mute">${fmtTime(th.lastAt)}</small>` : ""}${un ? `<i class="dot"></i>` : ""}</button>`; }).join("")}</div>
    <div class="ib-r">${cur ? `<div class="card ib-h row tight" style="align-items:center"><button class="ib back" id="ib_back" aria-label="Retour">←</button>${av(cur, "sm")}<b style="flex:1">${esc(sName(cur))}</b><button class="btn ghost small" id="ib_st">Voir sa fiche</button></div><div id="chat"></div>` : `<div class="card center mute">Choisissez un élève.</div>`}</div></div>`
    : `<div class="card center mute">Invitez d'abord un élève.</div>`);
  $$("[data-u]").forEach(b => b.onclick = () => messagesView(b.dataset.u));
  if (cur) {
    $("#ib_back").onclick = () => { stopPoll(); messagesView(null); };
    $("#ib_st").onclick = () => S.C.go("student", cur.id);
    chatBox($("#chat"), { api: api(), uid: cur.id, me: "t", other: sName(cur), onRead: () => { S.threads[cur.id] = { ...(S.threads[cur.id] || {}), readT: Date.now() }; const r = $(`[data-u="${cur.id}"]`); if (r) { r.classList.remove("un"); r.querySelector(".dot")?.remove(); } api().get("threads/" + cur.id).then(t => { if (t) { S.threads[cur.id] = t; const sm = r?.querySelector(".t small"); if (sm) sm.textContent = (t.lastFrom === "t" ? "Vous : " : "") + (t.lastText || ""); } socialBadges(); }).catch(() => {}); } });
  }
  socialBadges();
}

/* =================== RÉDACTIONS =================== */
export function writingsView() {
  ui.setTitle("✍️ Rédactions");
  const all = S.students.flatMap(s => (S.writings[s.id] || []).map(w => ({ s, w })));
  const by = st => all.filter(x => x.w.status === st);
  const row = ({ s, w }) => `<div class="item wrow" data-w="${s.id}|${w.id}">${av(s, "sm")}<div style="flex:1;min-width:0"><b>${esc(w.title || "Sans titre")}</b><div class="mute">${esc(sName(s))} · ${w.status === "sent" ? `envoyée ${fmtTime(w.sentAt)} · ${wordCount(w.text)} mots` : w.status === "done" ? `corrigée ${fmtDate(w.doneAt)}${w.grade ? " · " + esc(w.grade) : ""}${w.seenS ? " · 👁️ lue" : ""}` : w.status === "todo" ? `sujet donné ${fmtDate(w.at)}` : "brouillon en cours"}</div></div><span>›</span></div>`;
  ui.m.innerHTML = rulesBox("writings") + `<div class="card row tight" style="align-items:center"><div style="flex:1"><b>Productions écrites</b><div class="mute">Donnez un sujet, l'élève écrit et envoie ; vous annotez son texte et il voit la correction.</div></div><button class="btn" id="wn">+ Donner un sujet</button></div>
    <div class="card"><h3 style="margin-top:0">📥 À corriger (${by("sent").length})</h3><div class="list">${by("sent").map(row).join("") || `<p class="mute">Rien à corriger. ☕</p>`}</div></div>
    <div class="card"><h3 style="margin-top:0">📝 Sujets en attente (${by("todo").length + by("draft").length})</h3><div class="list">${[...by("todo"), ...by("draft")].map(row).join("") || `<p class="mute">Aucun.</p>`}</div></div>
    <div class="card"><h3 style="margin-top:0">✅ Corrigées</h3><div class="list">${by("done").slice(0, 30).map(row).join("") || `<p class="mute">Aucune pour l'instant.</p>`}</div></div>`;
  $("#wn").onclick = () => assignTopic();
  $$("[data-w]").forEach(b => b.onclick = () => { const [u, id] = b.dataset.w.split("|"); correctView(u, id); });
  socialBadges();
}
export async function assignTopic(uids) {
  const r = await modal({ title: "📝 Donner un sujet de rédaction", wide: true, body: `<label class="f">Titre</label><input type="text" id="tp_t" placeholder="ex. Mi ciudad">
    <label class="f">Consigne</label><textarea id="tp_p" rows="4" placeholder="ex. Décris ta ville en 80 à 120 mots : où elle se trouve, ce qu'on peut y faire, ce que tu aimes. Utilise hay, está, es."></textarea>`,
    buttons: [{ label: "Annuler", value: null }, { label: "Choisir les élèves…", primary: true, act: a => { const t = $("#tp_t", a.body).value.trim(), p = $("#tp_p", a.body).value.trim(); if (!t || !p) { toast("Titre et consigne, s'il vous plaît."); return false; } return { t, p }; } }] }).result;
  if (!r) return;
  const who = uids || await pickStudents({ title: "Pour quels élèves ?", ok: "Donner le sujet" }); if (!who || !who.length) return;
  try {
    for (const uid of who) {
      const id = api().newId(`writings/${uid}/items`), d = { title: r.t, prompt: r.p, text: "", status: "todo", at: Date.now() };
      await api().set(`writings/${uid}/items/${id}`, d, false); (S.writings[uid] = S.writings[uid] || []).unshift({ id, ...d });
    }
    toast(`Sujet donné à ${who.length} élève(s) ✓`); writingsView();
  } catch (e) { toast(rulesHint(e), 6000); }
}
export function correctView(uid, id) {
  const s = studentById(uid), w = (S.writings[uid] || []).find(x => x.id === id); if (!s || !w) return writingsView();
  ui.setTitle(`✍️ ${esc(w.title || "Rédaction")}`, () => S.C.go("writings"));
  if (w.status === "todo" || w.status === "draft") {
    ui.m.innerHTML = `<div class="card"><b>${esc(sName(s))}</b> n'a pas encore envoyé ce texte (${W_STATUS[w.status]}).${w.prompt ? `<div class="prof" style="margin-top:8px">📝 ${esc(w.prompt)}</div>` : ""}<p><button class="btn danger small" id="wdel">🗑️ Retirer ce sujet</button></p></div>`;
    $("#wdel").onclick = () => delWriting(uid, w);
    return;
  }
  ui.m.innerHTML = `<div class="card"><div class="row tight" style="align-items:center">${av(s, "sm")}<b style="flex:1">${esc(sName(s))}</b><span class="mute">envoyée ${fmtTime(w.sentAt)} · ${wordCount(w.text)} mots</span></div>${w.prompt ? `<div class="prof" style="margin:8px 0 0">📝 ${esc(w.prompt)}</div>` : ""}</div>
    <div class="card"><div class="cbar"><button class="btn small" id="c_err" title="Sélectionnez le mot faux, puis cliquez">🟥 Erreur → correction</button><button class="btn ghost small" id="c_rem">💡 Remarque</button><button class="btn ghost small" id="c_un">↩️ Retirer l'annotation</button><button class="btn ghost small" id="c_reset">Repartir du texte d'origine</button></div>
      <p class="mute" style="margin:6px 0">Sélectionnez un mot ou un passage puis choisissez une annotation. Vous pouvez aussi taper directement dans le texte.</p>
      <div class="rte corr" id="c_ed" contenteditable="true" spellcheck="false">${safeHtml(w.corr || textToHtml(w.text))}</div>
      <div class="grid2"><div><label class="f">Appréciation (facultatif)</label><input type="text" id="c_g" value="${esc(w.grade || "")}" placeholder="ex. 16/20 ou ¡Muy bien!"></div><div></div></div>
      <label class="f">Commentaire général</label><textarea id="c_c" rows="4" placeholder="ex. Très bon vocabulaire ! Attention à ser / estar avec les lieux.">${esc(w.comment || "")}</textarea>
      <div class="row" style="margin-top:10px"><button class="btn ghost" id="c_prev">👁️ Aperçu élève</button><button class="btn" id="c_send">${w.status === "done" ? "💾 Mettre à jour la correction" : "📤 Envoyer la correction"}</button></div>
      <p class="center"><a href="#" class="mute" id="c_del">Supprimer cette rédaction</a></p></div>`;
  const ed = $("#c_ed");
  const sel = () => { const r = getSelection(); if (!r.rangeCount || r.isCollapsed || !ed.contains(r.anchorNode)) { toast("Sélectionnez d'abord un mot ou un passage dans le texte."); return null; } return r.getRangeAt(0); };
  const wrap = (rg, tag, attrs = {}) => { const el = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); el.appendChild(rg.extractContents()); rg.insertNode(el); return el; };
  $("#c_err").onmousedown = $("#c_rem").onmousedown = $("#c_un").onmousedown = e => e.preventDefault(); // garde la sélection
  $("#c_err").onclick = async () => {
    const rg = sel(); if (!rg) return; const txt = rg.toString();
    const fix = await promptDlg("Correction", "", { label: `Erreur : « ${esc(txt)} » — écrivez la forme correcte (laissez vide pour seulement barrer)`, ok: "Annoter" });
    if (fix === null) return;
    const d = wrap(rg, "del"); if (fix) { const i = document.createElement("ins"); i.textContent = fix; d.after(" ", i); }
  };
  $("#c_rem").onclick = async () => {
    const rg = sel(); if (!rg) return;
    const note = await promptDlg("Remarque", "", { label: "Votre remarque (l'élève la lit en touchant le passage surligné)", ok: "Ajouter" }); if (!note) return;
    wrap(rg, "mark", { title: note });
  };
  $("#c_un").onclick = () => {
    const r = getSelection(); let n = r.anchorNode; while (n && n !== ed && !["DEL", "INS", "MARK"].includes(n.nodeName)) n = n.parentNode;
    if (!n || n === ed) return toast("Placez le curseur dans une annotation.");
    if (n.nodeName === "INS") n.remove(); else { if (n.nodeName === "DEL" && n.nextSibling?.nodeType === 3 && n.nextSibling.nextSibling?.nodeName === "INS") { n.nextSibling.nextSibling.remove(); n.nextSibling.remove(); } n.replaceWith(...n.childNodes); }
  };
  $("#c_reset").onclick = async () => { if (await confirmDlg("Effacer toutes vos annotations et repartir du texte de l'élève ?", { ok: "Repartir de zéro", danger: true })) ed.innerHTML = textToHtml(w.text); };
  const data = () => ({ corr: safeHtml(ed.innerHTML), grade: $("#c_g").value.trim(), comment: $("#c_c").value.trim() });
  $("#c_prev").onclick = () => { const m = modal({ title: "👁️ Ce que verra l'élève", wide: true, body: correctionHtml({ ...w, ...data() }), buttons: [{ label: "Fermer", primary: true }] }); bindMarks(m.body); };
  $("#c_send").onclick = async () => {
    const d = { ...data(), status: "done", doneAt: Date.now(), seenS: null };
    try { await api().set(`writings/${uid}/items/${id}`, d); Object.assign(w, d); toast("Correction envoyée ✓"); S.C.go("writings"); } catch (e) { fail(e); }
  };
  $("#c_del").onclick = e => { e.preventDefault(); delWriting(uid, w); };
}
async function delWriting(uid, w) {
  if (!await confirmDlg("Supprimer définitivement cette rédaction ?", { ok: "Supprimer", danger: true })) return;
  try { await api().del(`writings/${uid}/items/${w.id}`); S.writings[uid] = S.writings[uid].filter(x => x.id !== w.id); S.C.go("writings"); } catch (e) { fail(e); }
}

/* Suppression complète des données sociales d'un élève (droit à l'effacement) */
export async function purgeSocial(uid) {
  try { for (const m of await api().list(`threads/${uid}/msgs`)) await api().del(`threads/${uid}/msgs/${m.id}`); await api().del("threads/" + uid); } catch (e) {}
  try { for (const w of await api().list(`writings/${uid}/items`)) await api().del(`writings/${uid}/items/${w.id}`); } catch (e) {}
  try { const b = `returns/${uid}/items`; for (const r of await api().list(b)) await deleteFile(api(), { ...r, base: b }); } catch (e) {}
  delete S.returns?.[uid];
  delete S.threads?.[uid]; delete S.writings?.[uid];
}

/* =================== CONFIDENTIALITÉ =================== */
export async function privacyCard(box) {
  const p = await loadPrivacy(api(), true);
  const cons = S.students.map(s => ({ s, ok: !!s.consentAt && (s.consentV || 1) >= p.v }));
  box.innerHTML = `<b>🔒 Confidentialité (RGPD)</b><p class="mute">Ce texte est affiché sur l'écran de connexion et dans « Mon compte » des élèves. Chaque élève doit l'accepter à sa première connexion.</p>
    <div class="row tight"><button class="btn ghost small" id="pr_ed">✏️ Modifier le texte</button><button class="btn ghost small" id="pr_see">👁️ Voir</button></div>
    <p class="mute" style="margin-top:10px"><b>Accords des élèves :</b> ${cons.map(c => `${esc(sName(c.s))} ${c.ok ? `✅ <small>${fmtDate(c.s.consentAt)}</small>` : "⏳"}`).join(" · ") || "aucun élève"}</p>
    <p class="mute" style="font-size:13px">ℹ️ Ce texte est un modèle de bonne foi, pas un avis juridique. Vérifiez dans la console Firebase (Firestore › Paramètres) l'emplacement de vos données ; s'il est en Europe (ex. europe-west1), vous pouvez le préciser.</p>`;
  $("#pr_see", box).onclick = () => modal({ title: "🔒 Confidentialité", wide: true, body: privacyHtml(p), buttons: [{ label: "Fermer", primary: true }] });
  $("#pr_ed", box).onclick = async () => {
    const r = await modal({ title: "✏️ Politique de confidentialité", wide: true, body: `<p class="mute">Mise en forme : « # Titre », « ## Sous-titre », « - » pour une liste, **gras**. Une ligne vide sépare les paragraphes.</p>
      <textarea id="pr_t" rows="18" style="font-family:ui-monospace,monospace;font-size:14px">${esc(p.text)}</textarea>
      <label class="ck"><input type="checkbox" id="pr_v"> Changement important : demander à nouveau l'accord de tous les élèves</label>
      <p><a href="#" id="pr_def" class="mute">Revenir au texte proposé par défaut</a></p>`,
      onOpen: a => { $("#pr_def", a.body).onclick = e => { e.preventDefault(); $("#pr_t", a.body).value = DEFAULT_PRIVACY; }; },
      buttons: [{ label: "Annuler", value: null }, { label: "Enregistrer", primary: true, act: a => ({ text: $("#pr_t", a.body).value.trim() || DEFAULT_PRIVACY, bump: $("#pr_v", a.body).checked }) }] }).result;
    if (!r) return;
    try { await api().set("settings/privacy", { text: r.text, v: p.v + (r.bump ? 1 : 0), updatedAt: Date.now() }); toast("Politique enregistrée ✓"); privacyCard(box); } catch (e) { fail(e); }
  };
}
