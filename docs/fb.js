// Couche d'accès aux données : Firebase (production) ou navigateur (mode démo).
// Toute l'application passe par ces fonctions, jamais directement par Firebase.
import { firebaseConfig, ADMIN_EMAIL } from "./config.js";

export const DEMO = !firebaseConfig;
const V = "10.12.2";
let api = null;

// Firestore refuse les tableaux imbriqués (ex. vocabulaire [["hola","salut","O-la"], …]).
// On les convertit en { __a: [...] } à l'écriture, et on les retransforme à la lecture.
export function encode(v) {
  if (Array.isArray(v)) return v.map(x => Array.isArray(x) ? { __a: encode(x) } : encode(x));
  if (v && typeof v === "object") { const o = {}; for (const k in v) o[k] = encode(v[k]); return o; }
  return v;
}
export function decode(v) {
  if (Array.isArray(v)) return v.map(decode);
  if (v && typeof v === "object") {
    const keys = Object.keys(v);
    if (keys.length === 1 && keys[0] === "__a" && Array.isArray(v.__a)) return decode(v.__a);
    const o = {}; for (const k in v) o[k] = decode(v[k]); return o;
  }
  return v;
}

/* ======================= FIREBASE ======================= */
async function initFirebase() {
  const A = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const U = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  const F = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
  const app = A.initializeApp(firebaseConfig);
  const auth = U.getAuth(app);
  auth.languageCode = "fr";
  let db;
  try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
  catch (e) { db = F.getFirestore(app); } // navigateur sans stockage local : on continue sans cache
  const ref = p => F.doc(db, ...p.split("/"));
  const col = p => F.collection(db, ...p.split("/"));
  const back = () => ({ url: location.origin + location.pathname });
  return {
    onAuth: cb => U.onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, email: u.email } : null)),
    login: (e, p) => U.signInWithEmailAndPassword(auth, e, p),
    logout: () => U.signOut(auth),
    resetPassword: e => U.sendPasswordResetEmail(auth, e, back()),
    changePassword: async pw => U.updatePassword(auth.currentUser, pw),
    // Création d'un compte élève SANS déconnecter le professeur : seconde instance
    // Firebase, puis e-mail « choisissez votre mot de passe » qui sert d'invitation.
    createStudent: async email => {
      const sec = A.getApps().find(a => a.name === "invite") || A.initializeApp(firebaseConfig, "invite");
      const sa = U.getAuth(sec);
      const pw = crypto.getRandomValues(new Uint32Array(4)).join("-") + "Aa!";
      let uid;
      try { uid = (await U.createUserWithEmailAndPassword(sa, email, pw)).user.uid; }
      finally { try { await U.signOut(sa); } catch (e) {} }
      await U.sendPasswordResetEmail(auth, email, back());
      return uid;
    },
    get: async p => { const s = await F.getDoc(ref(p)); return s.exists() ? decode(s.data()) : null; },
    set: (p, d, merge = true) => F.setDoc(ref(p), encode(d), { merge }),
    replace: (p, d) => F.setDoc(ref(p), encode(d)),
    del: p => F.deleteDoc(ref(p)),
    list: async c => (await F.getDocs(col(c))).docs.map(d => ({ id: d.id, ...decode(d.data()) })),
    // Documents dont le tableau `field` contient `value` (ex. fichiers attribués à un élève)
    listContains: async (c, field, value) => (await F.getDocs(F.query(col(c), F.where(field, "array-contains", value)))).docs.map(d => ({ id: d.id, ...decode(d.data()) })),
    newId: c => F.doc(col(c)).id,
  };
}

/* ======================= MODE DÉMO ======================= */
// Données gardées dans le navigateur (IndexedDB, sinon mémoire). Aucun envoi.
async function initDemo() {
  const store = {};
  let idb = null;
  try {
    idb = await new Promise((ok, ko) => {
      const r = indexedDB.open("paso_demo", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
    });
    await new Promise((ok, ko) => {
      const t = idb.transaction("kv").objectStore("kv").openCursor();
      t.onsuccess = () => { const c = t.result; if (c) { store[c.key] = c.value; c.continue(); } else ok(); };
      t.onerror = () => ko(t.error);
    });
  } catch (e) { idb = null; }
  const persist = (p, v) => { if (!idb) return; try { const s = idb.transaction("kv", "readwrite").objectStore("kv"); v === undefined ? s.delete(p) : s.put(v, p); } catch (e) {} };
  const clone = o => o == null ? null : JSON.parse(JSON.stringify(o));
  const deepMerge = (a, b) => {
    for (const k in b) {
      if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) deepMerge(a[k], b[k]);
      else a[k] = clone(b[k]);
    }
    return a;
  };
  let cb = null, cur = null;
  try { cur = JSON.parse(sessionStorage.getItem("paso_demo_user") || "null"); } catch (e) {}
  const emit = () => { try { sessionStorage.setItem("paso_demo_user", JSON.stringify(cur)); } catch (e) {} cb && cb(cur); };
  const rid = () => Math.random().toString(36).slice(2, 12);
  const depth = c => c.split("/").length + 1;
  const inCol = (p, c) => p.startsWith(c + "/") && p.split("/").length === depth(c);
  return {
    onAuth: f => { cb = f; setTimeout(() => f(cur), 0); },
    login: async email => {
      email = email.trim().toLowerCase();
      if (email === ADMIN_EMAIL.toLowerCase() || email === "prof@demo") { cur = { uid: "admin", email }; return emit(); }
      const u = Object.entries(store).find(([p, d]) => inCol(p, "users") && d.email === email);
      if (!u) throw { code: "auth/user-not-found" };
      cur = { uid: u[0].slice(6), email }; emit();
    },
    logout: async () => { cur = null; emit(); },
    resetPassword: async () => {},
    changePassword: async () => {},
    createStudent: async email => {
      if (Object.entries(store).some(([p, d]) => inCol(p, "users") && d.email === email)) throw { code: "auth/email-already-in-use" };
      return "u_" + rid();
    },
    get: async p => clone(store[p] ?? null),
    set: async (p, d, merge = true) => { store[p] = merge && store[p] ? deepMerge(store[p], d) : clone(d); persist(p, store[p]); },
    replace: async (p, d) => { store[p] = clone(d); persist(p, store[p]); },
    del: async p => { delete store[p]; persist(p); },
    list: async c => Object.entries(store).filter(([p]) => inCol(p, c)).map(([p, d]) => ({ id: p.split("/").pop(), ...clone(d) })),
    listContains: async (c, f, v) => Object.entries(store).filter(([p, d]) => inCol(p, c) && (d[f] || []).includes(v)).map(([p, d]) => ({ id: p.split("/").pop(), ...clone(d) })),
    newId: () => rid(),
    reset: async () => { for (const k in store) persist(k); try { sessionStorage.removeItem("paso_demo_user"); } catch (e) {} },
  };
}

export async function fb() {
  if (!api) api = DEMO ? await initDemo() : await initFirebase();
  return api;
}

export const authError = e => ({
  "auth/invalid-credential": "E-mail ou mot de passe incorrect.",
  "auth/wrong-password": "Mot de passe incorrect.",
  "auth/user-not-found": "Aucun compte avec cet e-mail.",
  "auth/invalid-email": "Adresse e-mail invalide.",
  "auth/too-many-requests": "Trop d'essais. Patientez quelques minutes.",
  "auth/email-already-in-use": "Un compte existe déjà avec cet e-mail.",
  "auth/weak-password": "Mot de passe trop court (6 caractères minimum).",
  "auth/requires-recent-login": "Par sécurité, déconnectez-vous puis reconnectez-vous avant de changer le mot de passe.",
  "auth/network-request-failed": "Pas de connexion internet.",
  "auth/unauthorized-continue-uri": "Domaine non autorisé : ajoutez l'adresse GitHub Pages dans Firebase › Authentication › Paramètres › Domaines autorisés.",
  "permission-denied": "Accès refusé par les règles Firestore (voir README).",
}[e && e.code] || (e && e.message) || "Erreur inconnue.");
