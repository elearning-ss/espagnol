// Les 14 leçons de départ (espagnol d'Espagne).
// Elles ne servent qu'une fois : au premier lancement, le professeur clique
// « Installer les 14 leçons de départ ». Ensuite tout se modifie dans l'admin.
//
// Format :
//  course : HTML. Tout texte entre [[ ]] devient cliquable et se prononce.
//  vocab  : [espagnol, français, prononciation]
//  ex     : exercices
//    {t:"q", q, o:[bonne, fausse, fausse, fausse], x}  QCM (la 1re option est la bonne)
//    {t:"w", q, a:[réponses acceptées], x}              réponse écrite
//    {t:"o", q, a}                                       remettre les mots dans l'ordre
//    {t:"n", max}                                        dictée de nombre
//    map:1                                               affiche le plan au-dessus de la question

const MAP_HTML = `<div class="map"><div>🚉<br>Estación</div><div class="road">Calle Mayor</div><div>🏛️<br>Museo</div><div>🏦<br>Banco</div><div class="sq">⛲<br>Plaza</div><div>💊<br>Farmacia</div><div>☕<br>Bar</div><div class="you">📍<br>Estás aquí<br><small>↑ norte</small></div><div>⛪<br>Iglesia</div></div>`;

const letters = [["A","a"],["B","be"],["C","ce"],["D","de"],["E","e"],["F","efe"],["G","ge"],["H","hache"],["I","i"],["J","jota"],["K","ka"],["L","ele"],["M","eme"],["N","ene"],["Ñ","eñe"],["O","o"],["P","pe"],["Q","cu"],["R","erre"],["S","ese"],["T","te"],["U","u"],["V","uve"],["W","uve doble"],["X","equis"],["Y","ye"],["Z","zeta"]]
  .map(l => `<button class="say" data-say="${l[1]}"><b>${l[0]}</b><small>${l[1]}</small></button>`).join("");

const nums = "cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis diecisiete dieciocho diecinueve veinte".split(" ")
  .map((w, i) => `<button class="say" data-say="${w}"><b>${i}</b><small>${w}</small></button>`).join("");

export const SEED = [
{ id:"alfabeto", type:"T", emoji:"🔤", title:"Alphabet & prononciation",
  goal:"Lire n'importe quel mot espagnol à voix haute.",
  course:`<p>Bonne nouvelle : l'espagnol <b>se lit comme il s'écrit</b>. Avec les règles ci-dessous, vous pouvez lire n'importe quel mot. Touchez chaque mot en couleur pour l'entendre.</p>
<h3>L'alphabet : 27 lettres</h3>
<div class="letters">${letters}</div>
<p class="note">La lettre propre à l'espagnol : <b>ñ</b> (eñe), qui se prononce « gn » comme dans <i>montagne</i> : [[España]], [[mañana]].</p>
<h3>Les règles qui changent tout</h3>
<table><tr><th>Écrit</th><th>Son</th><th>Exemples</th></tr>
<tr><td>c + e / i, z</td><td>« th » anglais (langue entre les dents)</td><td>[[cerveza]] [[cine]] [[zapato]]</td></tr>
<tr><td>c + a/o/u, qu</td><td>k</td><td>[[casa]] [[queso]]</td></tr>
<tr><td>j, g + e / i</td><td>« r » raclé du fond de la gorge (la jota)</td><td>[[jamón]] [[gente]]</td></tr>
<tr><td>g + a/o/u, gu + e/i</td><td>g dur</td><td>[[gato]] [[guitarra]]</td></tr>
<tr><td>ll, y</td><td>y (comme dans <i>yoyo</i>)</td><td>[[calle]] [[playa]]</td></tr>
<tr><td>ñ</td><td>gn</td><td>[[niño]] [[año]]</td></tr>
<tr><td>ch</td><td>tch</td><td>[[chocolate]] [[noche]]</td></tr>
<tr><td>h</td><td>muette</td><td>[[hola]] [[hotel]]</td></tr>
<tr><td>v = b</td><td>b doux</td><td>[[vino]] [[vaso]]</td></tr>
<tr><td>r (début de mot), rr</td><td>r très roulé</td><td>[[perro]] [[Roma]]</td></tr>
<tr><td>u</td><td>ou</td><td>[[uno]] [[luna]]</td></tr>
<tr><td>e</td><td>é (jamais muet)</td><td>[[leche]] [[café]]</td></tr></table>
<h3>3 réflexes</h3>
<ul><li><b>Toutes les lettres se prononcent</b>, y compris le e final : [[noche]] = NO-tché.</li>
<li><b>Pas de nasales</b> comme en français : [[un]] = « oun », [[pan]] = « pann », [[bien]] = « bienn ».</li>
<li><b>L'accent tonique</b> : sur l'avant-dernière syllabe si le mot finit par une voyelle, n ou s ([[casa]], [[hablan]]) ; sur la dernière sinon ([[hablar]], [[ciudad]]). Sinon, l'accent est écrit : [[café]], [[música]], [[canción]].</li></ul>
<p class="note">Dans le sud de l'Espagne et en Amérique latine, c/z se prononcent souvent « s ». Ici, on apprend la prononciation du centre et du nord de l'Espagne.</p>`,
  vocab:[["¡Hola!","Salut ! / Bonjour !","O-la"],["¡Buenos días!","Bonjour ! (matin)","BOUÉ-nos DI-as"],["¡Buenas tardes!","Bonjour ! (après-midi)","BOUÉ-nas TAR-dés"],["¡Buenas noches!","Bonsoir / Bonne nuit","BOUÉ-nas NO-tchés"],["¡Adiós!","Au revoir !","a-DIOS"],["¡Hasta luego!","À plus tard !","AS-ta LOUÉ-go"],["Gracias","Merci","GRA-thias"],["De nada","De rien","dé NA-da"],["Por favor","S'il vous plaît","por fa-BOR"],["Sí / No","Oui / Non","si / no"],["Perdone","Excusez-moi","pèr-DO-né"],["la cerveza","la bière","thèr-BÉ-tha"],["el jamón","le jambon","kha-MONN"],["la calle","la rue","KA-yé"],["el niño","l'enfant","NI-gno"],["la ciudad","la ville","thiou-DAD"]],
  ex:[
   {t:"q",q:"Dans « cerveza », « ce » se prononce…",o:["thé (th anglais)","ché","ké","tché"],x:"c + e/i se prononce comme le th anglais en Espagne."},
   {t:"q",q:"Dans « jamón », le « j » se prononce…",o:["un r raclé de la gorge","dj","j français","y"],x:"C'est la jota, un son guttural."},
   {t:"q",q:"« ll » dans « calle » se prononce…",o:["y","l","ll comme dans « ville »","j"],x:"ll = y : KA-yé."},
   {t:"q",q:"Quelle lettre est toujours muette ?",o:["h","j","r","e"],x:"hola, hotel : le h ne se prononce jamais."},
   {t:"q",q:"« vino » se prononce…",o:["BI-no","VI-no","OUI-no","FI-no"],x:"En espagnol, v et b se prononcent pareil."},
   {t:"q",q:"Où tombe l'accent dans « ciudad » ?",o:["Sur la dernière syllabe","Sur la première syllabe","Sur le u","Il n'y en a pas"],x:"Le mot finit par une consonne (d) : accent sur la dernière syllabe."},
   {t:"q",q:"« ñ » dans « España » se prononce…",o:["gn","n","ni-a","ny dur"],x:"ñ = gn de montagne."},
   {t:"w",q:"Écrivez « merci » en espagnol.",a:["gracias"]}]},

{ id:"presentarse", type:"T", emoji:"🙋", title:"Se présenter",
  goal:"Donner son prénom, nom, âge, métier, état civil et situation familiale.",
  course:`<p>En Espagne, on se tutoie très vite (<b>tú</b>). Avec un inconnu âgé ou dans un cadre officiel, on vouvoie avec <b>usted</b> (verbe à la 3ᵉ personne).</p>
<h3>Prénom & nom</h3>
<p>[[Me llamo Julien.]] = Je m'appelle Julien.<br>[[Mi apellido es Martin.]] : <i>el nombre</i> = le prénom, <i>el apellido</i> = le nom de famille.</p>
<p class="note">Les Espagnols ont <b>deux noms de famille</b> : celui du père, puis celui de la mère. <i>Pedro Sánchez Pérez</i>.</p>
<p>Question : [[¿Cómo te llamas?]] (tú) / [[¿Cómo se llama usted?]]</p>
<h3>L'âge</h3>
<p>Comme en français, on <b>a</b> son âge (verbe <i>tener</i>) : [[Tengo cuarenta años.]] Question : [[¿Cuántos años tienes?]]</p>
<h3>La nationalité et la ville</h3>
<p>[[Soy francés.]] / [[Soy francesa.]] · [[Soy belga.]] · [[Vivo en Lyon.]] · [[Soy de Bruselas.]]</p>
<h3>Le métier</h3>
<p>[[¿A qué te dedicas?]] ou [[¿En qué trabajas?]] →<br>[[Soy profesor.]] (pas d'article après <i>soy</i>)<br>[[Trabajo en un banco.]]<br>[[Estoy jubilado.]] = je suis retraité. [[Estoy en paro.]] = je suis au chômage.</p>
<h3>État civil (avec <i>estar</i>)</h3>
<table><tr><th>Homme</th><th>Femme</th><th></th></tr>
<tr><td>[[casado]]</td><td>[[casada]]</td><td>marié(e)</td></tr>
<tr><td>[[soltero]]</td><td>[[soltera]]</td><td>célibataire</td></tr>
<tr><td>[[divorciado]]</td><td>[[divorciada]]</td><td>divorcé(e)</td></tr>
<tr><td>[[viudo]]</td><td>[[viuda]]</td><td>veuf / veuve</td></tr>
<tr><td colspan="2">[[Tengo pareja.]]</td><td>je suis en couple</td></tr></table>
<h3>Situation familiale</h3>
<p>[[Tengo dos hijos.]] · [[No tengo hijos.]] · [[Tengo una hija de seis años.]]</p>
<h3>Modèle complet</h3>
<div class="model">[[¡Hola! Me llamo Julien, tengo cuarenta años y soy francés. Vivo en Lyon. Soy profesor. Estoy casado y tengo dos hijos.]]<p class="fr">Salut ! Je m'appelle Julien, j'ai 40 ans et je suis français. J'habite à Lyon. Je suis professeur. Je suis marié et j'ai deux enfants.</p></div>
<p class="note">À vous : redites ce texte avec <b>vos</b> informations, à voix haute, 3 fois.</p>`,
  vocab:[["Me llamo…","Je m'appelle…","mé YA-mo"],["¿Cómo te llamas?","Comment t'appelles-tu ?","KO-mo té YA-mas"],["¿Cómo se llama usted?","Comment vous appelez-vous ?","KO-mo sé YA-ma ous-TÉ"],["el nombre","le prénom","NOMM-bré"],["el apellido","le nom de famille","a-pé-YI-do"],["¿Cuántos años tienes?","Quel âge as-tu ?","KOUANN-tos A-gnos TIÉ-nés"],["Tengo treinta años.","J'ai trente ans.","TÈNN-go TRÈÏNN-ta A-gnos"],["Soy francés / francesa.","Je suis français(e).","soï frann-THÉS"],["Vivo en París.","J'habite à Paris.","BI-bo ènn pa-RIS"],["¿A qué te dedicas?","Que fais-tu dans la vie ?","a ké té dé-DI-kas"],["Soy profesor / profesora.","Je suis professeur.","soï pro-fé-SOR"],["Estoy casado / casada.","Je suis marié(e).","ès-TOÏ ka-SA-do"],["Tengo dos hijos.","J'ai deux enfants.","TÈNN-go dos I-khos"],["No tengo hijos.","Je n'ai pas d'enfants.","no TÈNN-go I-khos"],["¡Encantado! / ¡Encantada!","Enchanté(e) !","ènn-kann-TA-do"],["¿Y tú?","Et toi ?","i TOU"]],
  ex:[
   {t:"q",q:"Comment demander poliment son nom à un inconnu âgé ?",o:["¿Cómo se llama usted?","¿Cómo te llamas?","¿Quién eres?","¿Cómo estás?"],x:"Vouvoiement = usted = 3ᵉ personne : se llama."},
   {t:"q",q:"« El apellido », c'est…",o:["le nom de famille","le prénom","le surnom","l'adresse"]},
   {t:"w",q:"Traduisez : Je m'appelle Marie.",a:["Me llamo Marie"]},
   {t:"w",q:"Traduisez : J'ai trente ans.",a:["Tengo treinta años","Tengo 30 años"]},
   {t:"q",q:"Une femme mariée dit :",o:["Estoy casada.","Estoy casado.","Tengo casada.","Soy casa."],x:"État civil avec estar, et l'adjectif s'accorde : -a."},
   {t:"q",q:"« Soy profesor » : pourquoi pas d'article ?",o:["Après ser, le métier s'utilise sans article.","C'est une faute.","Parce que profesor est masculin.","Parce qu'on tutoie."]},
   {t:"o",q:"Je suis professeur et j'habite à Madrid.",a:"Soy profesor y vivo en Madrid"},
   {t:"w",q:"Traduisez : Je n'ai pas d'enfants.",a:["No tengo hijos"]},
   {t:"q",q:"« ¿A qué te dedicas? » veut dire…",o:["Que fais-tu dans la vie ?","Où habites-tu ?","Quel âge as-tu ?","À qui penses-tu ?"]}]},

{ id:"presente", type:"G", emoji:"⏱️", title:"Le présent et ses exceptions",
  goal:"Conjuguer les verbes réguliers, les verbes à diphtongue et les irréguliers les plus courants.",
  course:`<p>En espagnol on <b>omet presque toujours le pronom sujet</b> : la terminaison indique qui parle. [[Hablo español.]] = Je parle espagnol.</p>
<h3>Les pronoms</h3>
<p><b>yo</b> je · <b>tú</b> tu · <b>él / ella</b> il / elle · <b>usted</b> vous (poli, 1 personne) · <b>nosotros / nosotras</b> nous · <b>vosotros / vosotras</b> vous (tutoiement pluriel) · <b>ellos / ellas</b> ils / elles · <b>ustedes</b> vous (poli, plusieurs)</p>
<p class="note">En Espagne, on dit <b>vosotros</b> pour tutoyer un groupe (amis, famille, élèves) et <b>ustedes</b> pour vouvoyer un groupe. <i>Usted</i> et <i>ustedes</i> se conjuguent comme <i>él</i> et <i>ellos</i>.</p>
<h3>Les 3 piliers</h3>
<div class="scroll"><table><tr><th></th><th>ser (être)</th><th>estar (être)</th><th>tener (avoir)</th></tr>
<tr><td>yo</td><td>[[soy]]</td><td>[[estoy]]</td><td>[[tengo]]</td></tr><tr><td>tú</td><td>[[eres]]</td><td>[[estás]]</td><td>[[tienes]]</td></tr><tr><td>él/ella/usted</td><td>[[es]]</td><td>[[está]]</td><td>[[tiene]]</td></tr><tr><td>nosotros</td><td>[[somos]]</td><td>[[estamos]]</td><td>[[tenemos]]</td></tr><tr><td>vosotros</td><td>[[sois]]</td><td>[[estáis]]</td><td>[[tenéis]]</td></tr><tr><td>ellos/ustedes</td><td>[[son]]</td><td>[[están]]</td><td>[[tienen]]</td></tr></table></div>
<p><b>ser</b> = ce qu'on est (identité, origine, métier, caractère) · <b>estar</b> = où l'on est et comment on va (lieu, état passager) : [[Soy francés.]] / [[Estoy cansado.]] / [[Estoy en casa.]]</p>
<h3>Les 3 groupes réguliers</h3>
<table><tr><th></th><th>-ar<br>hablar</th><th>-er<br>comer</th><th>-ir<br>vivir</th></tr>
<tr><td>yo</td><td>habl<b>o</b></td><td>com<b>o</b></td><td>viv<b>o</b></td></tr>
<tr><td>tú</td><td>habl<b>as</b></td><td>com<b>es</b></td><td>viv<b>es</b></td></tr>
<tr><td>él/ella</td><td>habl<b>a</b></td><td>com<b>e</b></td><td>viv<b>e</b></td></tr>
<tr><td>nosotros</td><td>habl<b>amos</b></td><td>com<b>emos</b></td><td>viv<b>imos</b></td></tr>
<tr><td>vosotros</td><td>habl<b>áis</b></td><td>com<b>éis</b></td><td>viv<b>ís</b></td></tr>
<tr><td>ellos</td><td>habl<b>an</b></td><td>com<b>en</b></td><td>viv<b>en</b></td></tr></table>
<h3>Les verbes « en botte » (diphtongue)</h3>
<p>La voyelle du radical change <b>sauf avec nosotros et vosotros</b> :</p>
<ul><li><b>e → ie</b> : [[querer]] → quiero, quieres, quiere, queremos, queréis, quieren. Pareil : <i>pensar, empezar, preferir, cerrar</i>.</li>
<li><b>o → ue</b> : [[poder]] → puedo, puedes, puede, podemos, podéis, pueden. Pareil : <i>dormir, volver, contar, encontrar</i>.</li>
<li><b>e → i</b> : [[pedir]] → pido, pides, pide, pedimos, pedís, piden. Pareil : <i>repetir, servir, vestirse</i>.</li></ul>
<h3>Les irréguliers à apprendre par cœur</h3>
<div class="scroll"><table class="small"><tr><th></th><th>yo</th><th>tú</th><th>él</th><th>nosotros</th><th>vosotros</th><th>ellos</th></tr>
<tr><td>ir<br><i>aller</i></td><td>voy</td><td>vas</td><td>va</td><td>vamos</td><td>vais</td><td>van</td></tr>
<tr><td>hacer<br><i>faire</i></td><td>hago</td><td>haces</td><td>hace</td><td>hacemos</td><td>hacéis</td><td>hacen</td></tr>
<tr><td>venir<br><i>venir</i></td><td>vengo</td><td>vienes</td><td>viene</td><td>venimos</td><td>venís</td><td>vienen</td></tr>
<tr><td>decir<br><i>dire</i></td><td>digo</td><td>dices</td><td>dice</td><td>decimos</td><td>decís</td><td>dicen</td></tr>
<tr><td>saber<br><i>savoir</i></td><td>sé</td><td>sabes</td><td>sabe</td><td>sabemos</td><td>sabéis</td><td>saben</td></tr>
<tr><td>salir<br><i>sortir</i></td><td>salgo</td><td>sales</td><td>sale</td><td>salimos</td><td>salís</td><td>salen</td></tr>
<tr><td>poner<br><i>mettre</i></td><td>pongo</td><td>pones</td><td>pone</td><td>ponemos</td><td>ponéis</td><td>ponen</td></tr>
<tr><td>dar<br><i>donner</i></td><td>doy</td><td>das</td><td>da</td><td>damos</td><td>dais</td><td>dan</td></tr>
<tr><td>ver<br><i>voir</i></td><td>veo</td><td>ves</td><td>ve</td><td>vemos</td><td>veis</td><td>ven</td></tr>
<tr><td>conocer<br><i>connaître</i></td><td>conozco</td><td>conoces</td><td>conoce</td><td>conocemos</td><td>conocéis</td><td>conocen</td></tr></table></div>
<p>Négation : <b>no</b> devant le verbe, c'est tout. [[No entiendo.]] = Je ne comprends pas.</p>`,
  vocab:[["yo soy","je suis","soï"],["tú eres","tu es","É-rés"],["nosotros somos","nous sommes","SO-mos"],["vosotros sois","vous êtes","soïs"],["estoy bien","je vais bien","ès-TOÏ biènn"],["tengo","j'ai","TÈNN-go"],["tenemos","nous avons","té-NÉ-mos"],["hablo","je parle","A-blo"],["No entiendo.","Je ne comprends pas.","no ènn-TIÈNN-do"],["voy","je vais","boï"],["hago","je fais","A-go"],["quiero","je veux","KIÉ-ro"],["puedo","je peux","POUÉ-do"],["tengo que…","je dois…","TÈNN-go ké"],["vengo","je viens","BÈNN-go"],["salgo","je sors","SAL-go"],["sé","je sais","sé"],["conozco","je connais","ko-NOTH-ko"]],
  ex:[
   {t:"w",q:"Conjuguez « hablar » avec nosotros.",a:["hablamos","nosotros hablamos"]},
   {t:"w",q:"Conjuguez « comer » avec vosotros.",a:["coméis","vosotros coméis"]},
   {t:"w",q:"Conjuguez « vivir » avec ellos.",a:["viven","ellos viven"]},
   {t:"q",q:"« Je peux » se dit…",o:["puedo","podo","pudo","poedo"],x:"poder : o → ue (sauf nosotros, vosotros)."},
   {t:"q",q:"« Nous voulons » se dit…",o:["queremos","quieremos","quieramos","queramos"],x:"Pas de diphtongue avec nosotros."},
   {t:"q",q:"« Je fais » se dit…",o:["hago","hazo","haco","hace"]},
   {t:"q",q:"« Je suis fatigué » :",o:["Estoy cansado.","Soy cansado.","Tengo cansado.","Estoy cansada son."],x:"État passager → estar."},
   {t:"q",q:"« Vous allez » (vosotros) :",o:["vais","vas","van","vamos"]},
   {t:"w",q:"Traduisez : Ils veulent un café.",a:["Quieren un café","Ellos quieren un café"]},
   {t:"o",q:"Je ne peux pas, je dois travailler.",a:"No puedo, tengo que trabajar"}]},

{ id:"numeros", type:"T", emoji:"🛍️", title:"Les chiffres, les achats, les vêtements",
  goal:"Compter, comprendre un prix, acheter un vêtement.",
  course:`<h3>De 0 à 20</h3>
<div class="letters">${nums}</div>
<h3>Les dizaines</h3>
<p>[[treinta]] 30 · [[cuarenta]] 40 · [[cincuenta]] 50 · [[sesenta]] 60 · [[setenta]] 70 · [[ochenta]] 80 · [[noventa]] 90 · [[cien]] 100 · [[mil]] 1000 · [[dos mil]] 2000</p>
<ul><li>De 21 à 29, en un seul mot : [[veintiuno]], [[veintidós]], [[veintitrés]].</li>
<li>À partir de 31, on sépare avec <b>y</b> : [[treinta y cinco]] (35), [[noventa y nueve]] (99).</li>
<li><b>cien</b> tout seul, mais <b>ciento</b> devant un autre nombre : [[ciento veinte]] (120).</li>
<li>Devant un nom masculin, <i>uno</i> devient <b>un</b> : [[veintiún años]].</li></ul>
<h3>Demander un prix</h3>
<p>[[¿Cuánto cuesta?]] → [[Cuesta quince euros.]]<br>Pluriel : [[¿Cuánto cuestan?]] → [[Cuestan treinta euros.]]<br>À la caisse : [[¿Cuánto es?]] (ça fait combien ?)<br>[[Diez euros con cincuenta.]] = 10,50 €.</p>
<h3>Les vêtements</h3>
<table><tr><td>[[la camiseta]]</td><td>le T-shirt</td></tr><tr><td>[[la camisa]]</td><td>la chemise</td></tr><tr><td>[[el jersey]]</td><td>le pull</td></tr><tr><td>[[los pantalones]]</td><td>le pantalon (pluriel !)</td></tr><tr><td>[[los vaqueros]]</td><td>le jean</td></tr><tr><td>[[la falda]]</td><td>la jupe</td></tr><tr><td>[[el vestido]]</td><td>la robe</td></tr><tr><td>[[la chaqueta]]</td><td>la veste</td></tr><tr><td>[[el abrigo]]</td><td>le manteau</td></tr><tr><td>[[los zapatos]]</td><td>les chaussures</td></tr><tr><td>[[el bolso]]</td><td>le sac à main</td></tr></table>
<p>Couleurs : [[rojo]] rouge · [[negro]] noir · [[blanco]] blanc · [[amarillo]] jaune · [[verde]] vert · [[azul]] bleu · [[gris]] gris · [[marrón]] marron · [[rosa]] rose. Les couleurs en -o s'accordent : <i>una camisa blanca</i>.</p>
<h3>En boutique</h3>
<div class="model">
<p><b>Dependienta :</b> [[Buenos días, ¿en qué puedo ayudarle?]] <span class="fr">Bonjour, je peux vous aider ?</span></p>
<p><b>Vous :</b> [[Busco una chaqueta negra.]] <span class="fr">Je cherche une veste noire.</span></p>
<p><b>Dependienta :</b> [[¿Qué talla usa?]] <span class="fr">Quelle taille faites-vous ?</span></p>
<p><b>Vous :</b> [[La cuarenta y dos. ¿Puedo probármela?]] <span class="fr">Du 42. Je peux l'essayer ?</span></p>
<p><b>Vous :</b> [[Me queda un poco pequeña. ¿Tiene una talla más grande?]] <span class="fr">Elle est un peu petite pour moi. Vous avez une taille au-dessus ?</span></p>
<p><b>Vous :</b> [[¡Perfecta! ¿Cuánto cuesta?]] … [[Me la llevo. ¿Puedo pagar con tarjeta?]]</p></div>
<p class="note">La taille d'un vêtement = <b>la talla</b> ; la pointure = <b>el número</b> : [[¿Qué número calza?]]</p>`,
  vocab:[["uno, dos, tres","un, deux, trois","OU-no, dos, trés"],["diez","dix","DIÈTH"],["veinte","vingt","BÈÏNN-té"],["cien","cent","THIÈNN"],["mil","mille","mil"],["¿Cuánto cuesta?","Combien ça coûte ?","KOUANN-to KOUÈS-ta"],["¿Cuánto es?","Ça fait combien ?","KOUANN-to ès"],["Cuesta diez euros.","Ça coûte dix euros.","KOUÈS-ta diéth ÉOU-ros"],["la camiseta","le T-shirt","ka-mi-SÉ-ta"],["la camisa","la chemise","ka-MI-sa"],["los pantalones","le pantalon","pann-ta-LO-nés"],["la falda","la jupe","FAL-da"],["la chaqueta","la veste","tcha-KÉ-ta"],["los zapatos","les chaussures","tha-PA-tos"],["la talla","la taille (vêtement)","TA-ya"],["¿Puedo probármelo?","Je peux l'essayer ?","POUÉ-do pro-BAR-mé-lo"],["Me lo llevo.","Je le prends.","mé lo YÉ-bo"],["Es demasiado caro.","C'est trop cher.","ès dé-ma-SIA-do KA-ro"]],
  ex:[
   {t:"n",max:20},{t:"n",max:99},{t:"n",max:99},
   {t:"q",q:"« treinta y ocho », c'est…",o:["38","28","83","48"]},
   {t:"q",q:"Comment dit-on 21 ?",o:["veintiuno","veinte y uno","veintiún uno","vente uno"]},
   {t:"w",q:"Écrivez en lettres : 16",a:["dieciséis"],x:"Attention à l'accent : dieciséis."},
   {t:"q",q:"« los zapatos », ce sont…",o:["les chaussures","les chaussettes","les sacs","les vestes"]},
   {t:"q",q:"Pour demander la pointure :",o:["¿Qué número calza?","¿Qué talla usa?","¿Cuánto cuesta?","¿Qué color?"]},
   {t:"w",q:"Traduisez : Combien ça coûte ?",a:["¿Cuánto cuesta?","Cuánto cuesta"]},
   {t:"o",q:"Je peux payer par carte ?",a:"¿Puedo pagar con tarjeta?"}]},

{ id:"genero", type:"G", emoji:"⚖️", title:"Masculin et féminin des noms",
  goal:"Choisir le bon article et former le pluriel.",
  course:`<h3>La règle de base</h3>
<table><tr><th>Terminaison</th><th>Genre</th><th>Exemple</th></tr>
<tr><td>-o</td><td>masculin</td><td>[[el libro]]</td></tr>
<tr><td>-a</td><td>féminin</td><td>[[la casa]]</td></tr>
<tr><td>-ción, -sión, -dad, -tad</td><td>féminin</td><td>[[la canción]] [[la ciudad]]</td></tr>
<tr><td>-e, consonne</td><td>à apprendre</td><td>[[el coche]] [[la noche]] [[el árbol]]</td></tr></table>
<h3>Les articles</h3>
<table><tr><th></th><th>Masculin</th><th>Féminin</th></tr>
<tr><td>le / la</td><td><b>el</b> [[el chico]]</td><td><b>la</b> [[la chica]]</td></tr>
<tr><td>les</td><td><b>los</b> [[los chicos]]</td><td><b>las</b> [[las chicas]]</td></tr>
<tr><td>un / une</td><td><b>un</b> [[un chico]]</td><td><b>una</b> [[una chica]]</td></tr>
<tr><td>des</td><td><b>unos</b> [[unos amigos]]</td><td><b>unas</b> [[unas amigas]]</td></tr></table>
<p class="note">Pas d'élision comme en français : [[el hotel]], [[la amiga]]. Contractions : a + el = <b>al</b>, de + el = <b>del</b>.</p>
<h3>Le pluriel</h3>
<ul><li>Voyelle → <b>+s</b> : [[la casa]] → [[las casas]], [[el café]] → [[los cafés]].</li>
<li>Consonne → <b>+es</b> : [[el árbol]] → [[los árboles]], [[la ciudad]] → [[las ciudades]].</li>
<li><b>-z → -ces</b> : [[el lápiz]] → [[los lápices]], [[la vez]] → [[las veces]].</li>
<li>L'accent écrit peut disparaître ou apparaître : [[la canción]] → [[las canciones]], [[el joven]] → [[los jóvenes]].</li>
<li>Le masculin pluriel englobe les deux sexes : [[los padres]] = le père et la mère, [[los hermanos]] = frères et sœurs.</li></ul>
<h3>Les exceptions</h3>
<ul><li><b>Masculins en -a</b> (souvent grecs) : [[el día]], [[el mapa]], [[el problema]], [[el idioma]], [[el sofá]].</li>
<li><b>Féminins en -o</b> : [[la mano]], [[la foto]], [[la moto]], [[la radio]].</li>
<li><b>El agua</b> : les mots féminins qui commencent par un <i>a</i> accentué prennent <b>el</b> au singulier, mais restent féminins : [[el agua fría]], [[las aguas]].</li></ul>
<h3>Les personnes</h3>
<p>-o/-a : [[el amigo]] / [[la amiga]] · consonne + a : [[el profesor]] / [[la profesora]] · -or/-triz : [[el actor]] / [[la actriz]] · identiques : [[el estudiante]] / [[la estudiante]], [[el turista]] / [[la turista]]</p>
<h3>Genre différent du français</h3>
<p>[[la leche]] le lait · [[la sal]] le sel · [[la miel]] le miel · [[la nariz]] le nez · [[el color]] la couleur · [[el dolor]] la douleur · [[el coche]] la voiture · [[el equipo]] l'équipe</p>`,
  vocab:[["el libro / los libros","le livre / les livres","LI-bro"],["la casa / las casas","la maison / les maisons","KA-sa"],["la ciudad / las ciudades","la ville / les villes","thiou-DAD"],["la canción","la chanson","kann-THIONN"],["el día","le jour","DI-a"],["el problema","le problème","pro-BLÉ-ma"],["el idioma","la langue","i-DIO-ma"],["la mano","la main","MA-no"],["la foto","la photo","FO-to"],["el agua","l'eau","A-goua"],["el lápiz / los lápices","le crayon / les crayons","LA-pith"],["la leche","le lait","LÉ-tché"],["el coche","la voiture","KO-tché"],["la nariz","le nez","na-RITH"]],
  ex:[
   {t:"q",q:"Quel article pour « problema » ?",o:["el","la","lo","los"],x:"Mot d'origine grecque : el problema."},
   {t:"q",q:"Pluriel de « la ciudad » :",o:["las ciudades","las ciudads","los ciudades","las ciudadas"]},
   {t:"q",q:"Pluriel de « el lápiz » :",o:["los lápices","los lápizes","los lápizs","las lápices"],x:"-z → -ces."},
   {t:"q",q:"« L'eau froide » se dit…",o:["el agua fría","la agua fría","el agua frío","lo agua fría"],x:"El devant le a accentué, mais l'adjectif reste féminin."},
   {t:"w",q:"Pluriel de « el libro » (avec l'article)",a:["los libros"]},
   {t:"q",q:"« La main » se dit…",o:["la mano","el mano","la mana","lo mano"]},
   {t:"q",q:"« Le lait » se dit…",o:["la leche","el leche","lo leche","el lecho"]},
   {t:"q",q:"Féminin de « el actor » :",o:["la actriz","la actora","la actresa","la actor"]},
   {t:"w",q:"Pluriel de « la canción » (avec l'article)",a:["las canciones"],x:"L'accent écrit disparaît au pluriel."}]},

{ id:"familia", type:"T", emoji:"👨‍👩‍👧", title:"La famille",
  goal:"Présenter sa famille et poser des questions sur celle des autres.",
  course:`<h3>Le vocabulaire</h3>
<table><tr><td>[[el padre]] / [[papá]]</td><td>le père / papa</td></tr><tr><td>[[la madre]] / [[mamá]]</td><td>la mère / maman</td></tr><tr><td>[[los padres]]</td><td>les parents</td></tr><tr><td>[[el hermano]] / [[la hermana]]</td><td>le frère / la sœur</td></tr><tr><td>[[el hijo]] / [[la hija]]</td><td>le fils / la fille</td></tr><tr><td>[[el marido]] / [[la mujer]]</td><td>le mari / la femme</td></tr><tr><td>[[el abuelo]] / [[la abuela]]</td><td>le grand-père / la grand-mère</td></tr><tr><td>[[el tío]] / [[la tía]]</td><td>l'oncle / la tante</td></tr><tr><td>[[el primo]] / [[la prima]]</td><td>le cousin / la cousine</td></tr><tr><td>[[el sobrino]] / [[la sobrina]]</td><td>le neveu / la nièce</td></tr><tr><td>[[el nieto]] / [[la nieta]]</td><td>le petit-fils / la petite-fille</td></tr><tr><td>[[el suegro]] / [[la suegra]]</td><td>beau-père / belle-mère (parents du conjoint)</td></tr><tr><td>[[el cuñado]] / [[la cuñada]]</td><td>beau-frère / belle-sœur</td></tr><tr><td>[[la pareja]]</td><td>le / la partenaire, le couple</td></tr></table>
<p class="note">Faux ami : [[los parientes]] = la famille au sens large (oncles, cousins…). Les parents (père + mère) = <b>los padres</b>. Et [[los hermanos]] = les frères et sœurs.</p>
<h3>Les possessifs</h3>
<table><tr><th></th><th>singulier</th><th>pluriel</th></tr>
<tr><td>mon, ma / mes</td><td>mi</td><td>mis</td></tr><tr><td>ton, ta / tes</td><td>tu</td><td>tus</td></tr><tr><td>son, sa / ses · votre (usted)</td><td>su</td><td>sus</td></tr><tr><td>notre / nos</td><td>nuestro, nuestra</td><td>nuestros, nuestras</td></tr><tr><td>votre / vos (vosotros)</td><td>vuestro, vuestra</td><td>vuestros, vuestras</td></tr><tr><td>leur / leurs</td><td>su</td><td>sus</td></tr></table>
<p>Comme en français, <b>pas d'article</b> devant le possessif : [[mi padre]], [[mis hermanos]], [[nuestra casa]].</p>
<p class="note">Attention : <b>tu</b> (ton) n'a pas d'accent, <b>tú</b> (toi) en a un. [[Tú y tu hermano.]]</p>
<h3>Parler de sa famille</h3>
<div class="model">[[En mi familia somos cuatro: mi padre, mi madre, mi hermana y yo.]]<p class="fr">Dans ma famille nous sommes quatre : mon père, ma mère, ma sœur et moi.</p></div>
<p>[[¿Tienes hermanos?]] · [[Tengo un hermano y dos hermanas.]] · [[Soy hijo único.]] (fils unique) · [[¿Cómo se llama tu madre?]] · [[¿Cuántos años tiene tu hermano?]] · [[Mi hermano mayor vive en Valencia.]]</p>`,
  vocab:[["los padres","les parents","PA-drés"],["los parientes","la famille (les proches)","pa-RIÈNN-tés"],["el padre","le père","PA-dré"],["la madre","la mère","MA-dré"],["el hermano","le frère","èr-MA-no"],["la hermana","la sœur","èr-MA-na"],["los hermanos","frères et sœurs","èr-MA-nos"],["el hijo","le fils","I-kho"],["la hija","la fille","I-kha"],["el marido","le mari","ma-RI-do"],["la mujer","la femme (épouse)","mou-KHÈR"],["el tío / la tía","l'oncle / la tante","TI-o"],["el primo","le cousin","PRI-mo"],["el sobrino","le neveu","so-BRI-no"],["el nieto","le petit-fils","NIÉ-to"],["la suegra","la belle-mère","SOUÉ-gra"],["el cuñado","le beau-frère","kou-GNA-do"],["¿Tienes hermanos?","As-tu des frères et sœurs ?","TIÉ-nés èr-MA-nos"]],
  ex:[
   {t:"q",q:"« los padres », ce sont…",o:["les parents (père et mère)","la famille élargie","les grands-parents","les pères uniquement"]},
   {t:"q",q:"« los parientes » veut dire…",o:["la famille (les proches)","les parents","les parrains","les patients"]},
   {t:"q",q:"Quelle phrase est correcte ?",o:["Mi hermana se llama Ana.","La mi hermana se llama Ana.","Mía hermana se llama Ana.","Mi la hermana se llama Ana."],x:"Pas d'article devant le possessif."},
   {t:"q",q:"« mes frères » :",o:["mis hermanos","mi hermanos","los mis hermanos","míos hermanos"]},
   {t:"w",q:"Traduisez : ma mère",a:["mi madre","mi mamá"]},
   {t:"q",q:"« el nieto », c'est…",o:["le petit-fils","le neveu","le grand-père","le cousin"]},
   {t:"q",q:"« ¿Tienes hermanos? » demande si vous avez…",o:["des frères et/ou sœurs","des frères uniquement","des enfants","des cousins"]},
   {t:"o",q:"J'ai un frère et deux sœurs.",a:"Tengo un hermano y dos hermanas"},
   {t:"w",q:"Traduisez : Comment s'appelle ton père ?",a:["¿Cómo se llama tu padre?","Cómo se llama tu padre"]}]},

{ id:"gustar", type:"G", emoji:"❤️", title:"Le verbe « gustar »",
  goal:"Dire ce qu'on aime et ce qu'on n'aime pas.",
  course:`<p>Pour dire « j'aime », l'espagnol dit « <b>ça me plaît</b> ». Le verbe s'accorde donc avec <b>la chose aimée</b>, pas avec la personne.</p>
<table><tr><th>Chose au singulier ou verbe</th><th>Chose au pluriel</th></tr>
<tr><td>[[Me gusta el chocolate.]]</td><td>[[Me gustan los perros.]]</td></tr>
<tr><td>[[Me gusta leer.]]</td><td>[[Me gustan las películas españolas.]]</td></tr></table>
<h3>À qui ça plaît ?</h3>
<table><tr><td>à moi</td><td>(a mí) <b>me</b> gusta</td></tr><tr><td>à toi</td><td>(a ti) <b>te</b> gusta</td></tr><tr><td>à lui / elle / vous (usted)</td><td>(a él / a ella / a usted) <b>le</b> gusta</td></tr><tr><td>à nous</td><td>(a nosotros) <b>nos</b> gusta</td></tr><tr><td>à vous (vosotros)</td><td>(a vosotros) <b>os</b> gusta</td></tr><tr><td>à eux / elles / vous (ustedes)</td><td>(a ellos / a ustedes) <b>les</b> gusta</td></tr></table>
<p>Avec un prénom : [[A Marcos le gusta el fútbol.]] = Marcos aime le foot. <i>A mí, a ti…</i> servent à insister : [[A mí me gusta el café.]]</p>
<h3>Négation & question</h3>
<p>[[No me gusta el café.]] · [[¿Te gusta España?]] · [[¿Le gusta?]] (vous aimez ?)</p>
<h3>Réagir</h3>
<p>[[¡A mí también!]] moi aussi · [[A mí tampoco.]] moi non plus · [[A mí sí.]] moi oui · [[A mí no.]] moi non</p>
<h3>Bonus</h3>
<ul><li><b>encantar</b> = adorer, même construction : [[Me encanta la paella.]] [[Me encantan las tapas.]]</li>
<li>Passé : [[Me ha gustado mucho.]] = ça m'a beaucoup plu (aujourd'hui) · [[Me gustó.]] (hier, l'an dernier).</li>
<li>Souhait : [[Me gustaría visitar Sevilla.]] = j'aimerais visiter Séville.</li>
<li>Attention avec les personnes : [[Me gustas.]] = tu me plais (attirance !). Pour l'affection en famille ou entre amis comme pour l'amour : [[Te quiero.]] ; [[Te amo.]] est très fort, presque littéraire.</li></ul>`,
  vocab:[["Me gusta…","J'aime… (singulier)","mé GOUS-ta"],["Me gustan…","J'aime… (pluriel)","mé GOUS-tann"],["No me gusta.","Je n'aime pas.","no mé GOUS-ta"],["¿Te gusta?","Tu aimes ?","té GOUS-ta"],["¿Le gusta?","Vous aimez ?","lé GOUS-ta"],["Me encanta…","J'adore…","mé ènn-KANN-ta"],["¡A mí también!","Moi aussi !","a MI tamm-BIÈNN"],["A mí tampoco.","Moi non plus.","a MI tamm-PO-ko"],["Me ha gustado.","Ça m'a plu.","mé a gous-TA-do"],["Me gustaría…","J'aimerais…","mé gous-ta-RI-a"],["Te quiero.","Je t'aime.","té KIÉ-ro"]],
  ex:[
   {t:"q",q:"Me ___ las tapas.",o:["gustan","gusta","gusto","gustas"],x:"« las tapas » est pluriel."},
   {t:"q",q:"Me ___ bailar.",o:["gusta","gustan","gusto","gustar"],x:"Devant un verbe : singulier."},
   {t:"q",q:"« Elle aime le cinéma » :",o:["Le gusta el cine.","Ella gusta el cine.","Se gusta el cine.","La gusta el cine."]},
   {t:"q",q:"« Vous aimez Madrid ? » (vosotros) :",o:["¿Os gusta Madrid?","¿Vos gusta Madrid?","¿Les gustáis Madrid?","¿Os gustáis Madrid?"]},
   {t:"q",q:"Quelqu'un dit « Me gusta el mar ». Vous aussi :",o:["¡A mí también!","¡Yo también gusta!","A mí tampoco.","¡Me también!"]},
   {t:"w",q:"Traduisez : J'aime les chats. (los gatos)",a:["Me gustan los gatos","A mí me gustan los gatos"]},
   {t:"w",q:"Traduisez : Tu aimes l'Espagne ?",a:["¿Te gusta España?","Te gusta España"]},
   {t:"q",q:"« A mí tampoco » veut dire…",o:["moi non plus","moi aussi","pas à moi","à moi oui"]},
   {t:"o",q:"Nous aimons beaucoup la cuisine espagnole.",a:"Nos gusta mucho la cocina española"}]},

{ id:"describir", type:"T", emoji:"🧑", title:"Décrire une personne",
  goal:"Décrire le physique et le caractère de quelqu'un.",
  course:`<p>Question : [[¿Cómo es?]] (comment est-il / elle ?)</p>
<h3>Le physique avec « ser »</h3>
<p>[[Es alto.]] / [[Es alta.]] grand(e) · [[bajo]] petit · [[delgado]] mince · [[fuerte]] costaud · [[joven]] jeune · [[mayor]] âgé (poli) · [[guapo]] beau · [[mono]] mignon</p>
<h3>Les traits avec « tener » et « llevar »</h3>
<p>[[Tiene el pelo corto.]] — pelo <i>[[largo]], [[corto]], [[rizado]] (frisé), [[liso]] (raide), [[rubio]] (blond), [[castaño]] (châtain), [[moreno]] (brun), [[canoso]] (grisonnant)</i></p>
<p>[[Tiene los ojos azules.]] — ojos <i>[[azules]], [[verdes]], [[marrones]], [[negros]]</i></p>
<p>[[Tiene barba.]] il a la barbe · [[Lleva gafas.]] il porte des lunettes</p>
<h3>Le caractère</h3>
<table><tr><td>[[simpático]]</td><td>sympathique</td><td>[[antipático]]</td><td>antipathique</td></tr><tr><td>[[majo]]</td><td>sympa (Espagne)</td><td>[[tímido]]</td><td>timide</td></tr><tr><td>[[amable]]</td><td>gentil, aimable</td><td>[[serio]]</td><td>sérieux</td></tr><tr><td>[[alegre]]</td><td>joyeux</td><td>[[perezoso]]</td><td>paresseux</td></tr><tr><td>[[divertido]]</td><td>drôle</td><td>[[cabezota]]</td><td>têtu</td></tr><tr><td>[[generoso]]</td><td>généreux</td><td>[[trabajador]]</td><td>travailleur</td></tr></table>
<h3>L'accord</h3>
<p>Adjectifs en -o : <b>-o, -a, -os, -as</b> → [[alto, alta, altos, altas]]. En -e : <b>-e, -es</b> → [[amable, amables]]. En consonne : <b>+es</b> → [[azul, azules]], [[joven, jóvenes]].</p>
<h3>Ser ou estar ?</h3>
<p>Avec <b>estar</b>, l'adjectif décrit un état du moment : [[Es aburrido.]] il est ennuyeux ≠ [[Está aburrido.]] il s'ennuie · [[Es listo.]] il est malin ≠ [[Está listo.]] il est prêt · [[Está cansada.]] elle est fatiguée.</p>
<div class="model">[[Mi hermana es alta y delgada. Tiene el pelo largo y castaño y los ojos verdes. Es muy simpática y un poco cabezota.]]<p class="fr">Ma sœur est grande et mince. Elle a les cheveux longs et châtains et les yeux verts. Elle est très sympa et un peu têtue.</p></div>`,
  vocab:[["¿Cómo es?","Comment est-il / elle ?","KO-mo ès"],["alto / alta","grand(e) (taille)","AL-to"],["bajo","petit","BA-kho"],["delgado","mince","dèl-GA-do"],["joven","jeune","KHO-bènn"],["mayor","âgé","ma-YOR"],["guapo / guapa","beau / belle","GOUA-po"],["el pelo","les cheveux","PÉ-lo"],["los ojos","les yeux","O-khos"],["rubio","blond","ROU-bio"],["moreno","brun","mo-RÉ-no"],["Lleva gafas.","Il porte des lunettes.","YÉ-ba GA-fas"],["la barba","la barbe","BAR-ba"],["simpático","sympathique","simm-PA-ti-ko"],["amable","gentil","a-MA-blé"],["divertido","drôle","di-bèr-TI-do"],["tímido","timide","TI-mi-do"],["cabezota","têtu","ka-bé-THO-ta"]],
  ex:[
   {t:"q",q:"« Elle est grande (de taille) » :",o:["Es alta.","Está alta.","Tiene alta.","Es alto."]},
   {t:"q",q:"« Il a les yeux bleus » :",o:["Tiene los ojos azules.","Es los ojos azules.","Tiene los ojos azul.","Lleva los ojos azules."]},
   {t:"q",q:"« Il porte des lunettes » :",o:["Lleva gafas.","Tiene lunetas.","Porta gafas.","Es gafas."]},
   {t:"q",q:"« Il s'ennuie » :",o:["Está aburrido.","Es aburrido.","Tiene aburrido.","Se aburrido."],x:"État du moment → estar. « Es aburrido » = il est ennuyeux."},
   {t:"w",q:"Traduisez : Il est gentil.",a:["Es amable","Es simpático","Él es amable"]},
   {t:"w",q:"Traduisez : Elle a les cheveux courts.",a:["Tiene el pelo corto","Ella tiene el pelo corto"]},
   {t:"q",q:"Pluriel de « joven » :",o:["jóvenes","jovens","jóvens","joveses"],x:"Consonne → +es, et l'accent écrit apparaît : JÓ-ve-nes."},
   {t:"o",q:"Mon frère est grand et timide.",a:"Mi hermano es alto y tímido"},
   {t:"q",q:"« cabezota » veut dire…",o:["têtu","chauve","intelligent","drôle"]}]},

{ id:"demostrativos", type:"G", emoji:"👉", title:"Adjectifs et pronoms démonstratifs",
  goal:"Dire « ce, cette, celui-ci, celui-là » selon la distance.",
  course:`<p>L'espagnol a <b>trois</b> démonstratifs, selon la distance :</p>
<table><tr><th>Distance</th><th>Masc. sg</th><th>Fém. sg</th><th>Masc. pl</th><th>Fém. pl</th></tr>
<tr><td>ici (près de moi)</td><td>[[este]]</td><td>[[esta]]</td><td>[[estos]]</td><td>[[estas]]</td></tr>
<tr><td>là (près de toi)</td><td>[[ese]]</td><td>[[esa]]</td><td>[[esos]]</td><td>[[esas]]</td></tr>
<tr><td>là-bas (loin)</td><td>[[aquel]]</td><td>[[aquella]]</td><td>[[aquellos]]</td><td>[[aquellas]]</td></tr></table>
<p>Ils correspondent aux trois adverbes : <b>aquí</b> (ici), <b>ahí</b> (là), <b>allí</b> (là-bas).</p>
<p>[[este libro]] · [[esa camisa]] · [[aquellas montañas]]</p>
<h3>Avec le temps</h3>
<p>[[este año]] cette année · [[esta semana]] cette semaine · [[esta noche]] ce soir · [[aquel día]] ce jour-là · [[en aquella época]] à cette époque-là</p>
<h3>Seul (pronom)</h3>
<p>Mêmes formes, sans le nom : [[Este es mi hermano.]] [[Esta es mi mujer.]] C'est la façon normale de présenter quelqu'un.<br>[[¿Qué chaqueta quieres? Esa.]] · [[Prefiero aquel.]]</p>
<h3>Le neutre : esto, eso, aquello</h3>
<p>Pour une chose qu'on ne nomme pas, ou une idée : [[¿Qué es esto?]] (qu'est-ce que c'est ?) · [[Eso es.]] (c'est ça !) · [[No entiendo eso.]]</p>
<h3>En boutique</h3>
<p>[[¿Cuánto cuesta este?]] · [[¿Puedo ver esa de ahí?]] · [[Me llevo estos.]]</p>`,
  vocab:[["este / esta","ce, cet / cette (ici)","ÈS-té"],["estos / estas","ces (ici)","ÈS-tos"],["ese / esa","ce / cette (là)","É-sé"],["aquel / aquella","ce / cette (là-bas)","a-KÈL"],["aquí / ahí / allí","ici / là / là-bas","a-KI / a-I / a-YI"],["este año","cette année","ÈS-té A-gno"],["esta noche","ce soir","ÈS-ta NO-tché"],["Este es mi hermano.","Voici mon frère.","ÈS-té ès mi èr-MA-no"],["¿Qué es esto?","Qu'est-ce que c'est ?","ké ès ÈS-to"],["Eso es.","C'est ça.","É-so ès"],["Prefiero ese.","Je préfère celui-là.","pré-FIÉ-ro É-sé"]],
  ex:[
   {t:"q",q:"___ libro (dans ma main) es muy bueno.",o:["Este","Ese","Aquel","Esto"]},
   {t:"q",q:"___ montañas (au loin) son preciosas.",o:["Aquellas","Estas","Esos","Aquellos"]},
   {t:"q",q:"Pour présenter sa femme :",o:["Esta es mi mujer.","Este es mi mujer.","Esto es mi mujer.","Esa es la mi mujer."]},
   {t:"w",q:"Traduisez : cette chemise (ici)",a:["esta camisa"]},
   {t:"w",q:"Traduisez : ces chaussures (ici)",a:["estos zapatos"]},
   {t:"q",q:"« Qu'est-ce que c'est ? » (objet inconnu) :",o:["¿Qué es esto?","¿Qué es este?","¿Qué es esta?","¿Qué es aquel?"],x:"Chose qu'on ne nomme pas → neutre esto."},
   {t:"q",q:"« cette année » :",o:["este año","esta año","esto año","ese años"]},
   {t:"q",q:"Quel adverbe va avec « ese » ?",o:["ahí","aquí","allí","acá"]}]},

{ id:"orientarse", type:"T", emoji:"🗺️", title:"S'orienter sur un plan",
  goal:"Demander son chemin et comprendre la réponse.",
  course:`<h3>Demander</h3>
<p>[[Perdone, ¿dónde está la estación?]] · [[¿Cómo llego al museo?]] · [[¿Hay una farmacia por aquí?]] · [[¿Está lejos?]] · [[¿Cuánto se tarda andando?]] (combien de temps à pied ?)</p>
<p class="note"><b>Hay</b> (il y a) pour un lieu indéterminé : [[¿Hay un banco por aquí?]] · <b>está</b> pour un lieu précis : [[¿Dónde está el Banco Santander?]]</p>
<h3>Les directions</h3>
<p>[[a la derecha]] à droite · [[a la izquierda]] à gauche · [[todo recto]] tout droit · [[en la esquina]] au coin · [[en el semáforo]] au feu · [[en el cruce]] au carrefour · [[la primera a la derecha]] la première à droite · [[la segunda a la izquierda]] la deuxième à gauche · [[dé la vuelta]] faites demi-tour · [[cruce la plaza]] traversez la place</p>
<h3>Situer un lieu</h3>
<p>[[cerca de]] près de · [[lejos de]] loin de · [[al lado de]] à côté de · [[delante de]] devant · [[detrás de]] derrière · [[enfrente de]] en face de · [[entre]] entre</p>
<p class="note">a + el = <b>al</b>, de + el = <b>del</b> → [[al lado del banco]], [[enfrente de la farmacia]].</p>
<h3>Le plan</h3>${MAP_HTML}
<div class="model">[[Para ir a la iglesia, gire a la derecha. Para ir a la plaza, siga todo recto. La farmacia está a la derecha de la plaza, enfrente del banco.]]<p class="fr">Pour aller à l'église, tournez à droite. Pour aller sur la place, continuez tout droit. La pharmacie est à droite de la place, en face de la banque.</p></div>
<p class="note">« gire, siga, tome, cruce » : c'est l'impératif de politesse, vu à l'étape 14. Pour l'instant, apprenez-les comme des formules.</p>
<p>Lieux : [[la estación]] la gare · [[la parada de autobús]] l'arrêt de bus · [[el hospital]] l'hôpital · [[el supermercado]] le supermarché · [[la calle]] la rue · [[el ayuntamiento]] la mairie</p>`,
  vocab:[["¿Dónde está…?","Où est… ?","DONN-dé ès-TA"],["¿Hay… por aquí?","Il y a… par ici ?","aï… por a-KI"],["¿Cómo llego a…?","Comment je vais à… ?","KO-mo YÉ-go a"],["¿Está lejos?","C'est loin ?","ès-TA LÉ-khos"],["cerca","près","THÈR-ka"],["a la derecha","à droite","a la dé-RÉ-tcha"],["a la izquierda","à gauche","a la ith-KIÈR-da"],["todo recto","tout droit","TO-do RRÈK-to"],["en la esquina","au coin","ènn la ès-KI-na"],["el semáforo","le feu rouge","sé-MA-fo-ro"],["al lado de","à côté de","al LA-do dé"],["enfrente de","en face de","ènn-FRÈNN-té dé"],["detrás de","derrière","dé-TRAS dé"],["la plaza","la place","PLA-tha"],["la estación","la gare","ès-ta-THIONN"],["Gire a la derecha.","Tournez à droite.","KHI-ré a la dé-RÉ-tcha"],["Siga todo recto.","Continuez tout droit.","SI-ga TO-do RRÈK-to"]],
  ex:[
   {t:"q",map:1,q:"Regardez le plan. La farmacia está ___ plaza.",o:["a la derecha de la","a la izquierda de la","detrás de la","lejos de la"]},
   {t:"q",map:1,q:"El bar está ___ ti.",o:["al lado de","enfrente de","lejos de","detrás de"]},
   {t:"q",map:1,q:"El banco está ___ farmacia.",o:["enfrente de la","al lado de la","detrás de la","encima de la"],x:"Ils se font face, de part et d'autre de la place."},
   {t:"q",map:1,q:"Depuis 📍, pour ir a la iglesia :",o:["Gire a la derecha.","Gire a la izquierda.","Siga todo recto.","Dé la vuelta."]},
   {t:"q",q:"« todo recto » =",o:["tout droit","toujours à droite","juste à côté","à l'arrière"]},
   {t:"q",q:"« Il y a une pharmacie par ici ? » :",o:["¿Hay una farmacia por aquí?","¿Está una farmacia por aquí?","¿Es una farmacia por aquí?","¿Tiene una farmacia por aquí?"],x:"Lieu indéterminé → hay."},
   {t:"w",q:"Traduisez : C'est loin ?",a:["¿Está lejos?","Está lejos"]},
   {t:"o",q:"Excusez-moi, où est la gare ?",a:"Perdone, ¿dónde está la estación?"}]},

{ id:"gerundio", type:"G", emoji:"🔄", title:"Le gérondif",
  goal:"Dire « je suis en train de… », « en faisant… », « ça fait… que ».",
  course:`<h3>Formation</h3>
<table><tr><td>-ar → <b>-ando</b></td><td>hablar → [[hablando]] · trabajar → [[trabajando]]</td></tr>
<tr><td>-er / -ir → <b>-iendo</b></td><td>comer → [[comiendo]] · vivir → [[viviendo]]</td></tr></table>
<p>Irréguliers : leer → [[leyendo]] · ir → [[yendo]] · oír → [[oyendo]] · dormir → [[durmiendo]] · pedir → [[pidiendo]] · decir → [[diciendo]] · venir → [[viniendo]]. Le gérondif ne s'accorde jamais.</p>
<h3>Usage 1 : estar + gérondif = être en train de</h3>
<table><tr><td>yo</td><td>estoy</td><td rowspan="6">+ comiendo</td></tr><tr><td>tú</td><td>estás</td></tr><tr><td>él/ella</td><td>está</td></tr><tr><td>nosotros</td><td>estamos</td></tr><tr><td>vosotros</td><td>estáis</td></tr><tr><td>ellos</td><td>están</td></tr></table>
<p>[[¿Qué estás haciendo?]] · [[Estoy trabajando.]] · [[Estamos viendo una película.]] · [[Está lloviendo.]] (il pleut, là maintenant)</p>
<p class="note">Les Espagnols l'utilisent beaucoup plus que notre « être en train de ». Toujours avec <b>estar</b>, jamais avec ser.</p>
<h3>Usage 2 : « en … -ant », sans « en »</h3>
<p>[[Aprendo español escuchando la radio.]] = J'apprends l'espagnol en écoutant la radio.</p>
<h3>Usage 3 : continuer, et « ça fait … que »</h3>
<p><b>seguir + gérondif</b> = continuer à : [[Sigo estudiando.]]<br><b>llevar + durée + gérondif</b> = ça fait … que : [[Llevo dos años estudiando español.]] = Ça fait deux ans que j'étudie l'espagnol.</p>
<h3>Avec un pronom</h3>
<p>Deux places possibles : [[Lo estoy haciendo.]] = [[Estoy haciéndolo.]] (attention à l'accent écrit quand on colle le pronom).</p>`,
  vocab:[["hablando","en parlant","a-BLANN-do"],["comiendo","en mangeant","ko-MIÈNN-do"],["leyendo","en lisant","lé-YÈNN-do"],["durmiendo","en dormant","dour-MIÈNN-do"],["haciendo","en faisant","a-THIÈNN-do"],["Estoy trabajando.","Je suis en train de travailler.","ès-TOÏ tra-ba-KHANN-do"],["¿Qué estás haciendo?","Qu'est-ce que tu fais ?","ké ès-TAS a-THIÈNN-do"],["Está lloviendo.","Il pleut (en ce moment).","ès-TA yo-BIÈNN-do"],["Sigo estudiando.","Je continue à étudier.","SI-go ès-tou-DIANN-do"],["Llevo dos años…","Ça fait deux ans que…","YÉ-bo dos A-gnos"]],
  ex:[
   {t:"w",q:"Gérondif de « hablar »",a:["hablando"]},
   {t:"w",q:"Gérondif de « hacer »",a:["haciendo"]},
   {t:"q",q:"« Je suis en train de manger » :",o:["Estoy comiendo.","Soy comiendo.","Estoy comer.","Tengo comiendo."]},
   {t:"q",q:"« Qu'est-ce que tu fais (en ce moment) ? »",o:["¿Qué estás haciendo?","¿Qué eres haciendo?","¿Qué estás hacendo?","¿Qué haces haciendo?"]},
   {t:"q",q:"Gérondif de « leer » :",o:["leyendo","leiendo","leando","lerendo"]},
   {t:"q",q:"Gérondif de « dormir » :",o:["durmiendo","dormiendo","dormando","duermiendo"],x:"o → u au gérondif."},
   {t:"q",q:"« Ça fait trois ans que j'habite ici » :",o:["Llevo tres años viviendo aquí.","Hago tres años viviendo aquí.","Estoy tres años vivido aquí.","Tengo tres años viviendo aquí."]},
   {t:"w",q:"Traduisez : Nous sommes en train de travailler.",a:["Estamos trabajando","Nosotros estamos trabajando"]},
   {t:"o",q:"J'apprends l'espagnol en écoutant de la musique.",a:"Aprendo español escuchando música"}]},

{ id:"rutina", type:"T", emoji:"☀️", title:"Décrire son quotidien",
  goal:"Raconter sa journée type avec les heures.",
  course:`<h3>Les verbes pronominaux</h3>
<p>Comme en français, le pronom se place devant le verbe :</p>
<table><tr><th colspan="2">levantarse (se lever)</th></tr><tr><td>yo</td><td>[[me levanto]]</td></tr><tr><td>tú</td><td>[[te levantas]]</td></tr><tr><td>él/ella</td><td>[[se levanta]]</td></tr><tr><td>nosotros</td><td>[[nos levantamos]]</td></tr><tr><td>vosotros</td><td>[[os levantáis]]</td></tr><tr><td>ellos</td><td>[[se levantan]]</td></tr></table>
<p>Autres : [[despertarse]] se réveiller (me despierto) · [[ducharse]] se doucher · [[vestirse]] s'habiller (me visto) · [[acostarse]] se coucher (me acuesto) · [[relajarse]] se détendre</p>
<h3>Une journée</h3>
<div class="model">[[Me despierto a las siete.]] [[Me levanto enseguida y me ducho.]] [[Desayuno.]] [[Salgo de casa a las ocho.]] [[Voy al trabajo en coche.]] [[Como a las dos.]] [[Termino de trabajar a las seis y vuelvo a casa.]] [[Ceno a las nueve.]] [[Veo un poco la tele.]] [[Me acuesto a las once.]]
<p class="fr">Je me réveille à 7 h. Je me lève tout de suite et je me douche. Je prends le petit-déjeuner. Je sors de chez moi à 8 h. Je vais au travail en voiture. Je déjeune à 14 h. Je finis de travailler à 18 h et je rentre à la maison. Je dîne à 21 h. Je regarde un peu la télé. Je me couche à 23 h.</p></div>
<p class="note">En Espagne on mange tard : déjeuner (<b>la comida</b>) vers 14 h, dîner (<b>la cena</b>) vers 21 h. « Comer » veut dire manger, mais aussi déjeuner.</p>
<h3>L'heure</h3>
<p>[[¿Qué hora es?]] → [[Es la una.]] · [[Son las tres.]]<br>[[¿A qué hora?]] → [[a las siete]] · [[a la una]] · [[a mediodía]] · [[a medianoche]] · [[a las ocho y media]] 8 h 30 · [[a las nueve y cuarto]] 9 h 15 · [[a las diez menos cuarto]] 9 h 45</p>
<h3>Les jours</h3>
<p>[[lunes]] · [[martes]] · [[miércoles]] · [[jueves]] · [[viernes]] · [[sábado]] · [[domingo]] (sans majuscule)</p>
<p>[[El sábado voy al mercado.]] = ce samedi · [[Los sábados voy al mercado.]] = tous les samedis.</p>
<h3>Fréquence et enchaînement</h3>
<p>[[siempre]] toujours · [[normalmente]] d'habitude · [[a menudo]] souvent · [[a veces]] parfois · [[nunca]] jamais : [[Nunca bebo café.]] = [[No bebo nunca café.]]<br>[[primero]] d'abord · [[luego]] puis · [[después]] après · [[al final]] à la fin</p>`,
  vocab:[["me despierto","je me réveille","mé dès-PIÈR-to"],["me levanto","je me lève","mé lé-BANN-to"],["me ducho","je me douche","mé DOU-tcho"],["desayuno","je prends le petit-déjeuner","dé-sa-YOU-no"],["como","je déjeune / je mange","KO-mo"],["ceno","je dîne","THÉ-no"],["vuelvo a casa","je rentre à la maison","BOUÈL-bo a KA-sa"],["me acuesto","je me couche","mé a-KOUÈS-to"],["¿Qué hora es?","Quelle heure est-il ?","ké O-ra ès"],["¿A qué hora?","À quelle heure ?","a ké O-ra"],["a las ocho y media","à 8 h 30","a las O-tcho i MÉ-dia"],["a la una","à 1 h","a la OU-na"],["normalmente","d'habitude","nor-mal-MÈNN-té"],["a menudo","souvent","a mé-NOU-do"],["a veces","parfois","a BÉ-thés"],["nunca","jamais","NOUNN-ka"],["lunes","lundi","LOU-nés"],["domingo","dimanche","do-MINN-go"]],
  ex:[
   {t:"q",q:"« Je me lève » :",o:["Me levanto","Yo levanto","Me levantas","Se levanto"]},
   {t:"q",q:"« À une heure » :",o:["a la una","a las una","a la uno","a una hora"],x:"1 h est au singulier : a la una."},
   {t:"w",q:"Traduisez : Je me réveille à sept heures.",a:["Me despierto a las siete","Me despierto a las 7"]},
   {t:"q",q:"« Los sábados voy al mercado » signifie…",o:["Tous les samedis, je vais au marché.","Samedi dernier je suis allé au marché.","Ce samedi j'irai au marché.","Le samedi est jour de marché."]},
   {t:"q",q:"« Nous nous couchons » (acostarse) :",o:["nos acostamos","nos acuestamos","se acostamos","os acostamos"],x:"Pas de diphtongue avec nosotros."},
   {t:"w",q:"Traduisez : Je ne bois jamais de café.",a:["Nunca bebo café","No bebo nunca café"]},
   {t:"q",q:"En Espagne, « la comida » vers 14 h, c'est…",o:["le déjeuner","le petit-déjeuner","le goûter","le dîner"]},
   {t:"o",q:"D'habitude je dîne à neuf heures.",a:"Normalmente ceno a las nueve"},
   {t:"q",q:"« a las nueve y media » =",o:["9 h 30","9 h 15","8 h 30","9 h 45"]}]},

{ id:"comparativos", type:"G", emoji:"📊", title:"Le comparatif et le superlatif",
  goal:"Comparer et dire « le plus », « très ».",
  course:`<h3>Comparer</h3>
<table><tr><td>plus… que</td><td><b>más … que</b></td><td>[[Madrid es más grande que Sevilla.]]</td></tr>
<tr><td>moins… que</td><td><b>menos … que</b></td><td>[[El tren es menos caro que el avión.]]</td></tr>
<tr><td>aussi… que</td><td><b>tan … como</b></td><td>[[Lucas es tan alto como Marcos.]]</td></tr>
<tr><td>autant de… que</td><td><b>tanto/a/os/as … como</b></td><td>[[Tengo tantos libros como tú.]]</td></tr></table>
<p class="note">Devant un nombre : <b>más de</b> → [[Hay más de cien personas.]]</p>
<h3>Le superlatif relatif : le plus…</h3>
<p><b>el / la / los / las más … de</b> : [[Es la ciudad más bonita de España.]] On ne répète pas l'article (≠ « la ville la plus belle »).</p>
<h3>Le superlatif absolu : très…</h3>
<p>Adjectif + <b>-ísimo</b> : [[guapo]] → [[guapísimo]], [[bueno]] → [[buenísimo]], [[caro]] → [[carísimo]]. Orthographe : [[rico]] → [[riquísimo]], [[largo]] → [[larguísimo]]. Ou simplement [[muy bonito]].</p>
<h3>Les irréguliers</h3>
<table class="small"><tr><th></th><th>plus…</th><th>le plus…</th></tr>
<tr><td>bueno / bien</td><td>[[mejor]] (meilleur, mieux)</td><td>[[el mejor]]</td></tr>
<tr><td>malo / mal</td><td>[[peor]] (pire)</td><td>[[el peor]]</td></tr>
<tr><td>grande (âge)</td><td>[[mayor]] (aîné, plus âgé)</td><td>[[el mayor]]</td></tr>
<tr><td>pequeño (âge)</td><td>[[menor]] (cadet)</td><td>[[el menor]]</td></tr></table>
<p>Bonne nouvelle : <b>mejor</b> sert à la fois pour « meilleur » et « mieux » : [[Es el mejor restaurante.]] / [[Hablas mejor que yo.]] Ne jamais dire « más mejor ».</p>
<p>[[mi hermano mayor]] = mon frère aîné · [[mi hermana menor]] = ma petite sœur</p>`,
  vocab:[["más… que","plus… que","mas… ké"],["menos… que","moins… que","MÉ-nos… ké"],["tan… como","aussi… que","tann… KO-mo"],["el más bonito","le plus beau","èl mas bo-NI-to"],["guapísimo","très beau","goua-PI-si-mo"],["buenísimo","très bon / délicieux","boué-NI-si-mo"],["riquísimo","délicieux","rri-KI-si-mo"],["mejor","meilleur / mieux","mé-KHOR"],["peor","pire","pé-OR"],["el mejor","le meilleur","èl mé-KHOR"],["hermano mayor","frère aîné","èr-MA-no ma-YOR"],["hermana menor","sœur cadette","èr-MA-na mé-NOR"]],
  ex:[
   {t:"q",q:"Madrid es más grande ___ Valencia.",o:["que","de","como","del"]},
   {t:"q",q:"Lucas es tan alto ___ Marcos.",o:["como","que","de","tan"]},
   {t:"q",q:"Hay más ___ cien personas.",o:["de","que","como","del"],x:"Devant un nombre : más de."},
   {t:"q",q:"« le meilleur restaurant » :",o:["el mejor restaurante","el más bueno mejor restaurante","el más mejor restaurante","el restaurante más bien"]},
   {t:"w",q:"Superlatif absolu de « guapo » (masc. sing.)",a:["guapísimo"]},
   {t:"q",q:"« Je parle mieux » :",o:["Hablo mejor.","Hablo más bien.","Hablo más mejor.","Hablo bueno."]},
   {t:"q",q:"« mon frère aîné » :",o:["mi hermano mayor","mi hermano mejor","mi hermano más grande de","mi hermano menor"]},
   {t:"w",q:"Traduisez avec -ísimo : C'est délicieux ! (rico)",a:["¡Está riquísimo!","Está riquísimo","Es riquísimo","¡Está riquísima!"]},
   {t:"o",q:"Le train est moins cher que l'avion.",a:"El tren es menos caro que el avión"}]},

{ id:"imperativo", type:"G", emoji:"📣", title:"L'impératif",
  goal:"Donner un ordre, un conseil, une indication.",
  course:`<h3>Les formes régulières</h3>
<div class="scroll"><table><tr><th></th><th>tú</th><th>vosotros</th><th>usted</th><th>ustedes</th></tr>
<tr><td>hablar</td><td>[[¡habla!]]</td><td>[[¡hablad!]]</td><td>[[¡hable!]]</td><td>[[¡hablen!]]</td></tr>
<tr><td>comer</td><td>[[¡come!]]</td><td>[[¡comed!]]</td><td>[[¡coma!]]</td><td>[[¡coman!]]</td></tr>
<tr><td>escribir</td><td>[[¡escribe!]]</td><td>[[¡escribid!]]</td><td>[[¡escriba!]]</td><td>[[¡escriban!]]</td></tr></table></div>
<p class="note"><b>tú</b> = présent sans le -s · <b>vosotros</b> = infinitif avec <b>-d</b> à la place du -r · <b>usted</b> : les voyelles s'inversent, -ar → <b>-e</b>, -er/-ir → <b>-a</b>. D'où [[¡Perdone!]], [[¡Oiga!]] (pour interpeller), [[Gire a la derecha.]]</p>
<h3>Les irréguliers (tú / usted)</h3>
<table class="small"><tr><th></th><th>tú</th><th>usted</th></tr>
<tr><td>decir</td><td>[[di]]</td><td>[[diga]]</td></tr><tr><td>hacer</td><td>[[haz]]</td><td>[[haga]]</td></tr><tr><td>ir</td><td>[[ve]]</td><td>[[vaya]]</td></tr><tr><td>poner</td><td>[[pon]]</td><td>[[ponga]]</td></tr><tr><td>salir</td><td>[[sal]]</td><td>[[salga]]</td></tr><tr><td>tener</td><td>[[ten]]</td><td>[[tenga]]</td></tr><tr><td>venir</td><td>[[ven]]</td><td>[[venga]]</td></tr><tr><td>ser</td><td>[[sé]]</td><td>[[sea]]</td></tr></table>
<p>Avec les verbes en diphtongue, on garde le changement : [[cierra]] / [[cierre]], [[vuelve]] / [[vuelva]], [[sigue]] / [[siga]].</p>
<h3>À la forme négative</h3>
<p>Les terminaisons s'inversent aussi pour tú et vosotros : [[¡No hables!]] [[¡No comas!]] [[¡No habléis!]] [[¡No se preocupe!]] (ne vous inquiétez pas)</p>
<h3>Avec un pronom</h3>
<p>Collé à la fin à l'affirmatif (avec accent écrit si besoin) : [[¡Dime!]] [[¡Ayúdame!]] [[¡Siéntese!]] (asseyez-vous)<br>Devant au négatif : [[¡No me digas!]] (sans blague !) [[¡No te preocupes!]]</p>
<h3>Retour au plan</h3>
<div class="model">[[Siga todo recto, gire a la derecha en el semáforo y tome la primera a la izquierda.]]<p class="fr">Continuez tout droit, tournez à droite au feu et prenez la première à gauche.</p></div>`,
  vocab:[["¡Habla!","Parle !","A-bla"],["¡Escucha!","Écoute !","ès-KOU-tcha"],["¡Oiga!","Excusez-moi ! (pour interpeller)","OÏ-ga"],["¡Perdone!","Pardon ! (poli)","pèr-DO-né"],["¡Perdona!","Pardon ! (tú)","pèr-DO-na"],["¡Dime!","Dis-moi !","DI-mé"],["¡Dígame!","Je vous écoute ! / Allô ?","DI-ga-mé"],["¡Ven!","Viens !","bènn"],["¡Vamos!","Allons-y !","BA-mos"],["¡No toques!","Ne touche pas !","no TO-kés"],["¡No se preocupe!","Ne vous inquiétez pas !","no sé pré-o-KOU-pé"],["¡Siéntese!","Asseyez-vous !","SIÈNN-té-sé"],["Tome la primera a la izquierda.","Prenez la première à gauche.","TO-mé la pri-MÉ-ra"]],
  ex:[
   {t:"q",q:"« Parle ! » (tú) :",o:["¡Habla!","¡Hable!","¡Hablas!","¡Hablar!"]},
   {t:"q",q:"« Mangez ! » (vosotros) :",o:["¡Comed!","¡Coméis!","¡Coman!","¡Comer!"],x:"vosotros : infinitif avec -d."},
   {t:"q",q:"« Excusez-moi » (usted) :",o:["¡Perdone!","¡Perdona!","¡Perdonad!","¡Perdonar!"]},
   {t:"q",q:"« Ne parle pas ! » :",o:["¡No hables!","¡No habla!","¡No hablar!","¡No hable tú!"],x:"Négatif avec tú : terminaison inversée + s."},
   {t:"q",q:"« Tournez à droite » (usted) :",o:["Gire a la derecha.","Gira a la derecha.","Girad a la derecha.","Girar a la derecha."]},
   {t:"w",q:"Impératif (tú) de « hacer »",a:["haz","¡haz!"]},
   {t:"q",q:"« Dis-moi ! » :",o:["¡Dime!","¡Dícime!","¡Me di!","¡Dimi!"]},
   {t:"w",q:"Impératif (usted) de « venir »",a:["venga","¡venga!"]},
   {t:"o",q:"Continuez tout droit et prenez la première à gauche.",a:"Siga todo recto y tome la primera a la izquierda"}]}
];

export { MAP_HTML };

// Parcours type proposé par défaut : les 14 étapes rangées en 4 chapitres.
export const DEFAULT_TEMPLATE = {
  name: "Débutant — les 14 étapes",
  chapters: [
    { id: "c1", title: "Chapitre 1 · Premiers pas", items: ["alfabeto", "presentarse", "presente"].map(id => ({ k: "l", id })) },
    { id: "c2", title: "Chapitre 2 · Moi et les autres", items: ["numeros", "genero", "familia", "gustar"].map(id => ({ k: "l", id })) },
    { id: "c3", title: "Chapitre 3 · Décrire et se repérer", items: ["describir", "demostrativos", "orientarse"].map(id => ({ k: "l", id })) },
    { id: "c4", title: "Chapitre 4 · Aller plus loin", items: ["gerundio", "rutina", "comparativos", "imperativo"].map(id => ({ k: "l", id })) },
  ],
  state: { "l:alfabeto": "open" },
};
