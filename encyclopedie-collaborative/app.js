// Démo locale : les articles sont enregistrés dans le navigateur.
// Pour une encyclopédie réellement collaborative, configure Supabase (voir README.md).
const starterArticles = [
 {id:"a1",title:"Comprendre les adresses IP",category:"Informatique",excerpt:"À quoi sert une adresse IP et comment les appareils communiquent sur un réseau ?",body:"Une adresse IP (Internet Protocol) est un identifiant attribué à un appareil sur un réseau utilisant le protocole IP. Elle permet d'acheminer les données vers le bon destinataire.\\n\\nOn distingue notamment les adresses IPv4, écrites avec quatre nombres séparés par des points, et les adresses IPv6, beaucoup plus longues.\\n\\nUne adresse privée est utilisée dans un réseau local, tandis qu'une adresse publique permet d'identifier une connexion sur Internet.",author:"Équipe Savoir",date:"2026-11-12"},
 {id:"a2",title:"Les grandes étapes de la Révolution française",category:"Histoire",excerpt:"Retour sur les événements majeurs qui ont transformé la France à partir de 1789.",body:"La Révolution française commence en 1789 dans un contexte de crise financière, sociale et politique.\\n\\nLa prise de la Bastille, le 14 juillet 1789, devient un symbole de la contestation populaire. La Déclaration des droits de l'homme et du citoyen est adoptée en août 1789.\\n\\nLa période révolutionnaire transforme durablement les institutions et la société françaises.",author:"Équipe Savoir",date:"2026-11-10"},
 {id:"a3",title:"Pourquoi le ciel est-il bleu ?",category:"Sciences",excerpt:"Un phénomène lumineux expliqué simplement grâce à la diffusion de Rayleigh.",body:"La lumière du Soleil semble blanche, mais elle est composée de plusieurs couleurs. Lorsqu'elle traverse l'atmosphère, les molécules de l'air diffusent davantage les courtes longueurs d'onde, notamment le bleu.\\n\\nCette diffusion, appelée diffusion de Rayleigh, explique pourquoi le ciel apparaît généralement bleu pendant la journée.",author:"Équipe Savoir",date:"2026-11-08"},
 {id:"a4",title:"Les bases de l'algorithmique",category:"Informatique",excerpt:"Variables, conditions et boucles : les premiers outils pour construire un programme.",body:"Un algorithme est une suite finie d'instructions permettant de résoudre un problème.\\n\\nUne variable stocke une information. Une condition permet de choisir entre plusieurs actions. Une boucle répète des instructions tant qu'une condition est remplie ou pour un nombre défini de répétitions.\\n\\nCes notions constituent la base de nombreux langages de programmation.",author:"Équipe Savoir",date:"2026-11-05"},
 {id:"a5",title:"Les couleurs complémentaires",category:"Arts & culture",excerpt:"Comment les couleurs opposées sur le cercle chromatique créent du contraste.",body:"Sur un cercle chromatique, deux couleurs complémentaires sont placées face à face. Leur association crée un contraste visuel fort.\\n\\nPar exemple, le bleu et l'orange, le rouge et le vert ou le jaune et le violet sont des couples de couleurs complémentaires. Les artistes et les designers les utilisent pour attirer l'attention ou équilibrer une composition.",author:"Équipe Savoir",date:"2026-11-02"},
 {id:"a6",title:"Le théorème de Pythagore",category:"Mathématiques",excerpt:"Une propriété essentielle pour calculer une longueur dans un triangle rectangle.",body:"Dans un triangle rectangle, le carré de la longueur de l'hypoténuse est égal à la somme des carrés des deux autres côtés.\\n\\nSi le triangle ABC est rectangle en A, alors BC² = AB² + AC². Cette relation permet de calculer une longueur lorsque les deux autres sont connues.",author:"Équipe Savoir",date:"2026-10-30"}
];
const categories=[["⌘","Informatique","Réseaux, programmation et numérique","Informatique"],["⚗","Sciences","Physique, chimie et SVT","Sciences"],["◷","Histoire","Événements et civilisations","Histoire"],["✳","Arts & culture","Création, musique et société","Arts & culture"]];
let articles=JSON.parse(localStorage.getItem("savoir_articles")||"null")||starterArticles;
let activeCategory="Tous", query="";
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function save(){localStorage.setItem("savoir_articles",JSON.stringify(articles))}
function renderCategories(){$("#categoryGrid").innerHTML=categories.map(([icon,name,desc])=>`<button class="category-card" data-category="${esc(name)}"><span class="category-icon">${icon}</span><h3>${esc(name)}</h3><p>${esc(desc)}</p></button>`).join("")+`<button class="category-card" data-category="Mathématiques"><span class="category-icon">∑</span><h3>Mathématiques</h3><p>Logique, calcul et géométrie</p></button>`}
function render(){
 let list=articles.filter(a=>(activeCategory==="Tous"||a.category===activeCategory)&&(`${a.title} ${a.excerpt} ${a.body} ${a.category}`).toLowerCase().includes(query.toLowerCase()));
 if($("#sortSelect").value==="title")list.sort((a,b)=>a.title.localeCompare(b.title,"fr"));else list.sort((a,b)=>b.date.localeCompare(a.date));
 $("#articleCount").textContent=articles.length;
 $("#articleGrid").innerHTML=list.map(a=>`<article class="article-card" data-id="${esc(a.id)}"><div class="article-top"><span class="tag">${esc(a.category)}</span><span class="article-date">${new Date(a.date+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})}</span></div><h3>${esc(a.title)}</h3><p>${esc(a.excerpt||a.body.slice(0,115)+"…")}</p><div class="article-bottom"><span>Par ${esc(a.author||"Contributeur")}</span><span class="article-arrow">↗</span></div></article>`).join("");
 $("#emptyState").hidden=list.length!==0;
}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
function openArticle(id){const a=articles.find(x=>x.id===id);if(!a)return;$("#readContent").innerHTML=`<span class="tag">${esc(a.category)}</span><h1 class="read-title">${esc(a.title)}</h1><div class="read-meta">Par ${esc(a.author||"Contributeur")} · ${new Date(a.date+"T12:00:00").toLocaleDateString("fr-FR")}</div><div class="read-body">${esc(a.body)}</div>`;$("#readDialog").showModal()}
function openWrite(){$("#articleForm").reset();$("#articleDialog").showModal()}
renderCategories();render();
$("#searchInput").addEventListener("input",e=>{query=e.target.value;render();});
$("#sortSelect").addEventListener("change",render);
document.addEventListener("click",e=>{
 const card=e.target.closest(".article-card");if(card)openArticle(card.dataset.id);
 const cat=e.target.closest("[data-category]");if(cat){activeCategory=cat.dataset.category;document.querySelectorAll(".filter-chip").forEach(b=>b.classList.toggle("selected",b.dataset.filter===activeCategory));render();$("#articles").scrollIntoView({behavior:"smooth"});}
 const filter=e.target.closest(".filter-chip");if(filter){activeCategory=filter.dataset.filter;document.querySelectorAll(".filter-chip").forEach(b=>b.classList.toggle("selected",b===filter));render();}
 const close=e.target.closest("[data-close]");if(close)$("#"+close.dataset.close).close();
});
["writeTop","writeBottom"].forEach(id=>$("#"+id).addEventListener("click",openWrite));
$("#loginBtn").addEventListener("click",()=>$("#loginDialog").showModal());
$("#writeTop").addEventListener("keydown",e=>{if(e.key==="Enter")openWrite()});
$("#articleForm").addEventListener("submit",e=>{
 e.preventDefault();
 const title=$("#articleTitle").value.trim(),category=$("#articleCategory").value,body=$("#articleBody").value.trim();
 if(body.length<30){toast("Ajoute un peu plus de contenu (30 caractères minimum).");return;}
 const excerpt=$("#articleExcerpt").value.trim()||body.slice(0,135)+"…";
 articles.unshift({id:"u"+Date.now(),title,category,excerpt,body,author:"Contributeur local",date:new Date().toISOString().slice(0,10)});
 save();activeCategory="Tous";query="";$("#searchInput").value="";document.querySelectorAll(".filter-chip").forEach(b=>b.classList.toggle("selected",b.dataset.filter==="Tous"));render();$("#articleDialog").close();$("#articles").scrollIntoView({behavior:"smooth"});toast("Article ajouté à cette démonstration !");
});
$("#loginForm").addEventListener("submit",e=>{e.preventDefault();$("#loginDialog").close();toast("La connexion sera disponible après configuration de Supabase.");});
$("#resetSearch").addEventListener("click",()=>{query="";activeCategory="Tous";$("#searchInput").value="";document.querySelectorAll(".filter-chip").forEach(b=>b.classList.toggle("selected",b.dataset.filter==="Tous"));render();});
$("#mobileMenu").addEventListener("click",()=>document.querySelector(".top-actions").classList.toggle("mobile-open"));
