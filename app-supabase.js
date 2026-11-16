const sb=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const $=s=>document.querySelector(s);
let rows=[],user=null,category="Tous",query="";
const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function notice(s){const t=$("#toast");t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500)}
function date(s){return new Date(s).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})}
function draw(){
 const list=rows.filter(x=>(category==="Tous"||x.category===category)&&(x.title+" "+x.excerpt+" "+x.body+" "+x.category).toLowerCase().includes(query.toLowerCase()));
 const order=$("#sortSelect").value;
 if(order==="title")list.sort((x,y)=>x.title.localeCompare(y.title,"fr"));
 else if(order==="oldest")list.sort((x,y)=>new Date(x.created_at)-new Date(y.created_at));
 else list.sort((x,y)=>new Date(y.created_at)-new Date(x.created_at));
 $("#articleCount").textContent=rows.length;
 $("#contributorCount").textContent=new Set(rows.map(x=>x.author_id).filter(Boolean)).size;
 $("#articleGrid").innerHTML=list.map(x=>'<article class="article-card" data-id="'+esc(x.id)+'"><div class="article-top"><span class="tag">'+esc(x.category)+'</span><span class="article-date">'+date(x.created_at)+'</span></div><h3>'+esc(x.title)+'</h3><p>'+esc(x.excerpt||x.body.slice(0,115))+'</p><div class="article-bottom"><span>Par '+esc(x.author_name)+'</span><span class="article-arrow">↗</span></div></article>').join("");
 $("#emptyState").hidden=list.length>0;
}
async function load(){const r=await sb.from("articles").select("*").order("created_at",{ascending:false});if(r.error){notice("Erreur de chargement des articles.");return}rows=r.data||[];draw()}
async function syncUser(){const r=await sb.auth.getUser();user=r.data.user;$("#loginBtn").textContent=user?"Déconnexion":"Connexion";$("#writeTop").textContent=user?"＋ Écrire un article":"＋ Se connecter"}
function openWrite(){if(!user){$("#loginDialog").showModal();notice("Connecte-toi pour publier.");return}$("#articleForm").reset();$("#articleDialog").showModal()}
function read(id){const a=rows.find(x=>x.id===id);if(!a)return;$("#readContent").innerHTML='<span class="tag">'+esc(a.category)+'</span><h1 class="read-title">'+esc(a.title)+'</h1><div class="read-meta">Par '+esc(a.author_name)+' · '+date(a.created_at)+'</div><div class="read-body">'+esc(a.body)+'</div>';$("#readDialog").showModal()}
$("#searchInput").addEventListener("input",e=>{query=e.target.value;draw()});
$("#sortSelect").addEventListener("change",draw);
$("#categorySelect").addEventListener("change",e=>{category=e.target.value;draw()});
document.addEventListener("click",e=>{
 const card=e.target.closest(".article-card");if(card)read(card.dataset.id);
 const close=e.target.closest("[data-close]");if(close)$("#"+close.dataset.close).close();
});
["writeTop","writeBottom"].forEach(id=>$("#"+id).addEventListener("click",openWrite));
$("#loginBtn").addEventListener("click",async()=>{if(user){await sb.auth.signOut();user=null;await syncUser();notice("Déconnecté.")}else $("#loginDialog").showModal()});
$("#authMode").addEventListener("change",e=>{const yes=e.target.value==="signup";$("#displayNameWrap").hidden=!yes;$("#loginTitle").textContent=yes?"Créer un compte":"Connexion";$("#authSubmit").textContent=yes?"Créer mon compte":"Se connecter"});
$("#loginForm").addEventListener("submit",async e=>{
 e.preventDefault();const email=$("#email").value,password=$("#password").value,signup=$("#authMode").value==="signup";let r;
 if(signup){const name=$("#displayName").value.trim();if(!name){notice("Saisis un pseudo.");return}r=await sb.auth.signUp({email,password,options:{data:{display_name:name}}})}
 else r=await sb.auth.signInWithPassword({email,password});
 if(r.error){notice(r.error.message);return}
 if(signup&&!r.data.session){$("#loginDialog").close();notice("Vérifie tes e-mails pour confirmer ton compte.");return}
 user=r.data.user;await syncUser();$("#loginDialog").close();notice("Connexion réussie.");
});
$("#articleForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!user){notice("Connecte-toi pour publier.");return}
 const body=$("#articleBody").value.trim();if(body.length<30){notice("Ajoute au moins 30 caractères.");return}
 const payload={title:$("#articleTitle").value.trim(),category:$("#articleCategory").value,excerpt:$("#articleExcerpt").value.trim()||body.slice(0,135),body:body,author_id:user.id,author_name:user.user_metadata.display_name||user.email.split("@")[0]};
 const r=await sb.from("articles").insert(payload);if(r.error){notice("Erreur : "+r.error.message);return}
 $("#articleDialog").close();category="Tous";query="";$("#searchInput").value="";$("#categorySelect").value="Tous";await load();notice("Article publié pour tous les visiteurs !");
});
$("#resetSearch").addEventListener("click",()=>{query="";category="Tous";$("#searchInput").value="";$("#categorySelect").value="Tous";draw()});
$("#mobileMenu").addEventListener("click",()=>document.querySelector(".top-actions").classList.toggle("mobile-open"));
sb.auth.onAuthStateChange((_e,s)=>{user=s?s.user:null;$("#loginBtn").textContent=user?"Déconnexion":"Connexion"});
(async()=>{await syncUser();await load()})();
