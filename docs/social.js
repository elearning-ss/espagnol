// Messagerie professeur ⇄ élève et rédactions corrigées (partagé entre les deux espaces).
//   threads/{uid}              : { lastAt, lastFrom: "t"|"s", lastText, readT, readS }
//   threads/{uid}/msgs/{id}    : { f: "t"|"s", t: texte, at }
//   writings/{uid}/items/{id}  : { title, prompt, text, status: "todo"|"draft"|"sent"|"done", at, sentAt, corr, comment, grade, doneAt, seenS }
import { $, $$, esc, fmtTime, textToHtml, safeHtml, accentBar, bindAccents } from "./core.js";

export const unreadFor = (th, who) => !!th && th.lastFrom !== who && (th.lastAt || 0) > ((who === "t" ? th.readT : th.readS) || 0);

export async function loadThread(api, uid) {
  const L = await api.list(`threads/${uid}/msgs`);
  return L.sort((a, b) => a.at - b.at);
}
export async function sendMsg(api, uid, from, text) {
  const t = String(text || "").trim().slice(0, 4000); if (!t) return null;
  const at = Date.now(), id = api.newId(`threads/${uid}/msgs`);
  await api.set(`threads/${uid}/msgs/${id}`, { f: from, t, at }, false);
  await api.set(`threads/${uid}`, { lastAt: at, lastFrom: from, lastText: t.slice(0, 140), [from === "t" ? "readT" : "readS"]: at });
  return { id, f: from, t, at };
}
export const markRead = (api, uid, who) => api.set(`threads/${uid}`, { [who === "t" ? "readT" : "readS"]: Date.now() }).catch(() => {});

let poll = null;
export const stopPoll = () => { clearInterval(poll); poll = null; };
/* Fil de discussion. me = "t" (professeur) ou "s" (élève). */
export function chatBox(box, { api, uid, me, other, readOnly = false, onRead }) {
  stopPoll();
  let msgs = [], sig = "";
  box.innerHTML = `<div class="chat"><div class="chat-l" id="ch_l"><p class="mute center">Chargement…</p></div>
    ${readOnly ? "" : `<div class="chat-in"><textarea id="ch_t" rows="2" placeholder="Votre message…" spellcheck="false"></textarea><button class="btn" id="ch_s" aria-label="Envoyer">Envoyer</button></div>${accentBar()}`}</div>`;
  const list = $("#ch_l", box);
  const draw = () => {
    const s = msgs.length + ":" + (msgs[msgs.length - 1]?.at || 0); if (s === sig) return; sig = s;
    let lastDay = "";
    list.innerHTML = msgs.map(m => {
      const day = new Date(m.at).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" });
      const sep = day !== lastDay ? `<div class="ch-day">${day}</div>` : ""; lastDay = day;
      return `${sep}<div class="bub ${m.f === me ? "me" : "them"}"><div>${textToHtml(m.t)}</div><small>${new Date(m.at).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })}</small></div>`;
    }).join("") || `<p class="mute center" style="margin:30px 0">Aucun message pour l'instant. Écrivez le premier ${me === "s" ? "à votre professeur" : `à ${esc(other)}`} !</p>`;
    list.scrollTop = list.scrollHeight;
  };
  const refresh = async () => {
    try { msgs = await loadThread(api, uid); draw(); if (!readOnly) { await markRead(api, uid, me); onRead && onRead(); } }
    catch (e) { list.innerHTML = `<div class="warn">${rulesHint(e)}</div>`; stopPoll(); }
  };
  if (!readOnly) {
    const ta = $("#ch_t", box);
    bindAccents(box, () => ta);
    const send = async () => {
      const t = ta.value.trim(); if (!t) return;
      const b = $("#ch_s", box); b.disabled = true;
      try { const m = await sendMsg(api, uid, me, t); if (m) { msgs.push(m); ta.value = ""; draw(); onRead && onRead(); } }
      catch (e) { box.insertAdjacentHTML("afterbegin", `<div class="warn">${rulesHint(e)}</div>`); }
      b.disabled = false; ta.focus();
    };
    $("#ch_s", box).onclick = send;
    ta.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey && !matchMedia("(pointer:coarse)").matches) { e.preventDefault(); send(); } };
  }
  refresh();
  poll = setInterval(() => { if (!box.isConnected) return stopPoll(); if (!document.hidden) refresh(); }, 30000);
}
export function rulesHint(e) {
  const perm = /permission|insufficient/i.test(String(e?.code || e?.message || e));
  return perm ? "La messagerie et les rédactions ne sont pas encore activées : les règles de sécurité Firebase doivent être mises à jour (voir les instructions du professeur)." : "Erreur : " + esc(e?.message || e);
}

/* ---------- rédactions ---------- */
export const W_STATUS = { todo: "📝 À écrire", draft: "✏️ Brouillon", sent: "⏳ Envoyée, en attente de correction", done: "✅ Corrigée" };
export async function loadWritings(api, uid) { return (await api.list(`writings/${uid}/items`)).sort((a, b) => (b.sentAt || b.at || 0) - (a.sentAt || a.at || 0)); }
export const wordCount = t => (String(t || "").trim().match(/[^\s]+/g) || []).length;
/* Correction affichée : texte annoté + commentaire + appréciation */
export function correctionHtml(w) {
  return `${w.grade ? `<div class="grade">${esc(w.grade)}</div>` : ""}
    <div class="corr">${safeHtml(w.corr || textToHtml(w.text))}</div>
    <p class="mute legend"><del>barré</del> = erreur · <ins>vert</ins> = correction · <mark>surligné</mark> = remarque (touchez-la)</p>
    ${w.comment ? `<div class="prof">💬 <b>Commentaire de votre professeur</b>\n${esc(w.comment)}</div>` : ""}`;
}
export function bindMarks(root) {
  $$("mark[title]", root).forEach(m => m.onclick = () => {
    const n = m.nextElementSibling; if (n?.classList.contains("mnote")) return n.remove();
    m.insertAdjacentHTML("afterend", `<span class="mnote">💡 ${esc(m.title)}</span>`);
  });
}
