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
async function syncUser(){const r=await sb.auth.getUser();user=r.data.user;$("#accountEmail").textContent=user?(user.email||"Compte connecté"):""}
function openWrite(){if(!user){$("#loginDialog").showModal();notice("Connecte-toi pour publier.");return}$("#articleForm").reset();$("#articleDialog").showModal()}
function read(id){const a=rows.find(x=>x.id===id);if(!a)return;$("#readContent").innerHTML='<span class="tag">'+esc(a.category)+'</span><h1 class="read-title">'+esc(a.title)+'</h1><div class="read-meta">Par '+esc(a.author_name)+' · '+date(a.created_at)+'</div><div class="read-body">'+esc(a.body)+'</div>';$("#readDialog").showModal()}
$("#searchInput").addEventListener("input",e=>{query=e.target.value;draw()});
$("#sortSelect").addEventListener("change",draw);
$("#categorySelect").addEventListener("change",e=>{category=e.target.value;draw()});
document.addEventListener("click",e=>{
 const card=e.target.closest(".article-card");if(card)read(card.dataset.id);
 const close=e.target.closest("[data-close]");if(close)$("#"+close.dataset.close).close();
});
const menuToggle=$("#menuToggle"),menuDropdown=$("#menuDropdown");
menuToggle.addEventListener("click",()=>{const open=menuDropdown.hidden;menuDropdown.hidden=!open;menuToggle.setAttribute("aria-expanded",String(open))});
document.addEventListener("click",e=>{if(!e.target.closest(".menu-wrap")){menuDropdown.hidden=true;menuToggle.setAttribute("aria-expanded","false")}});
menuDropdown.addEventListener("click",async e=>{
 const action=e.target.closest("[data-menu-action]")?.dataset.menuAction;
 if(!action)return;
 menuDropdown.hidden=true;menuToggle.setAttribute("aria-expanded","false");
 if(action==="settings")$("#settingsDialog").showModal();
 if(action==="account"){if(user){$("#accountEmail").textContent=user.email||"Compte connecté";$("#accountUsername").value=user.user_metadata?.display_name||"";$("#accountNewEmail").value="";$("#accountNewPassword").value="";$("#mfaEnrollBox").hidden=true;await refreshMfa();$("#accountDialog").showModal()}else $("#loginDialog").showModal()}
 if(action==="contribution")openWrite();
});
const applyTheme=theme=>{
 const selected=["light","dark","oled"].includes(theme)?theme:"light";
 if(selected==="light")delete document.body.dataset.theme;else document.body.dataset.theme=selected;
 localStorage.setItem("savoir-theme",selected);
 document.querySelectorAll("[data-theme-choice]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.themeChoice===selected)));
 document.querySelector('meta[name="theme-color"]')?.setAttribute("content",selected==="oled"?"#000000":selected==="dark"?"#171a17":"#fafaf8");
};
applyTheme(localStorage.getItem("savoir-theme")||"light");
document.querySelectorAll("[data-theme-choice]").forEach(b=>b.addEventListener("click",()=>applyTheme(b.dataset.themeChoice)));

$("#saveUsername").addEventListener("click",async()=>{
 if(!user)return;
 const name=$("#accountUsername").value.trim();
 if(name.length<2){notice("Le pseudo doit contenir au moins 2 caractères.");return}
 const {data,error}=await sb.auth.updateUser({data:{display_name:name}});
 if(error){notice("Erreur : "+error.message);return}
 user=data.user;
 const updated=await sb.from("articles").update({author_name:name}).eq("author_id",user.id);
 if(updated.error){notice("Pseudo modifié, mais les anciens articles n'ont pas tous été actualisés.");}
 else notice("Nom d'utilisateur mis à jour !");
 await load();
});
$("#saveEmail").addEventListener("click",async()=>{
 if(!user)return;
 const email=$("#accountNewEmail").value.trim();
 if(!email){notice("Saisis une nouvelle adresse e-mail.");return}
 const {error}=await sb.auth.updateUser({email});
 if(error){notice("Erreur : "+error.message);return}
 $("#accountNewEmail").value="";
 notice("E-mail de confirmation envoyé. Valide le changement depuis ta boîte mail.");
});
$("#savePassword").addEventListener("click",async()=>{
 if(!user)return;
 const password=$("#accountNewPassword").value;
 if(password.length<8){notice("Choisis un mot de passe d'au moins 8 caractères.");return}
 const {error}=await sb.auth.updateUser({password});
 if(error){notice("Erreur : "+error.message);return}
 $("#accountNewPassword").value="";
 notice("Mot de passe modifié.");
});
\n
let pendingMfaFactor=null;
async function refreshMfa(){
 const {data,error}=await sb.auth.mfa.listFactors();
 if(error){$("#mfaStatus").textContent="Impossible de charger les facteurs : "+error.message;return}
 const verified=(data.totp||[]).filter(x=>x.status==="verified");
 $("#mfaStatus").textContent=verified.length?"Double authentification activée.":"Double authentification désactivée.";
 $("#enableMfa").hidden=verified.length>0;
 $("#disableMfa").hidden=verified.length===0;
}
$("#enableMfa").addEventListener("click",async()=>{
 const {data,error}=await sb.auth.mfa.enroll({factorType:"totp",friendlyName:"Savoir - Authenticator"});
 if(error){notice("Erreur : "+error.message);return}
 pendingMfaFactor=data;
 $("#mfaQr").src=data.totp.qr_code;
 $("#mfaSecret").textContent=data.totp.secret;
 $("#mfaVerifyCode").value="";
 $("#mfaEnrollBox").hidden=false;
 $("#enableMfa").hidden=true;
});
$("#verifyMfa").addEventListener("click",async()=>{
 if(!pendingMfaFactor)return;
 const code=$("#mfaVerifyCode").value.trim();
 if(!/^\d{6}$/.test(code)){notice("Saisis le code à 6 chiffres.");return}
 const challenge=await sb.auth.mfa.challenge({factorId:pendingMfaFactor.id});
 if(challenge.error){notice("Erreur : "+challenge.error.message);return}
 const result=await sb.auth.mfa.verify({factorId:pendingMfaFactor.id,challengeId:challenge.data.id,code});
 if(result.error){notice("Code incorrect ou expiré : "+result.error.message);return}
 pendingMfaFactor=null;$("#mfaEnrollBox").hidden=true;notice("Double authentification activée !");await refreshMfa();
});
$("#disableMfa").addEventListener("click",async()=>{
 const {data,error}=await sb.auth.mfa.listFactors();
 if(error){notice(error.message);return}
 const factor=(data.totp||[]).find(x=>x.status==="verified");
 if(!factor)return;
 const result=await sb.auth.mfa.unenroll({factorId:factor.id});
 if(result.error){notice("Impossible de désactiver : "+result.error.message);return}
 notice("Double authentification désactivée.");await refreshMfa();
});
\n$("#accountLogout").addEventListener("click",async()=>{const r=await sb.auth.signOut();if(r.error){notice("Impossible de se déconnecter.");return}user=null;$("#accountDialog").close();notice("Déconnecté.")});
$("#authMode").addEventListener("change",e=>{const yes=e.target.value==="signup";$("#displayNameWrap").hidden=!yes;$("#loginTitle").textContent=yes?"Créer un compte":"Connexion";$("#authSubmit").textContent=yes?"Créer mon compte":"Se connecter"});
$("#loginForm").addEventListener("submit",async e=>{
 e.preventDefault();const email=$("#email").value,password=$("#password").value,signup=$("#authMode").value==="signup";let r;
 if(signup){const name=$("#displayName").value.trim();if(!name){notice("Saisis un pseudo.");return}r=await sb.auth.signUp({email,password,options:{data:{display_name:name}}})}
 else r=await sb.auth.signInWithPassword({email,password});
 if(r.error){notice(r.error.message);return}
 if(signup&&!r.data.session){$("#loginDialog").close();notice("Vérifie tes e-mails pour confirmer ton compte.");return}
 user=r.data.user;
 if(!signup){
  const factors=await sb.auth.mfa.listFactors();
  const factor=(factors.data?.totp||[]).find(x=>x.status==="verified");
  if(factor){
   const challenge=await sb.auth.mfa.challenge({factorId:factor.id});
   if(challenge.error){notice(challenge.error.message);return}
   pendingMfaFactor={id:factor.id,challengeId:challenge.data.id};
   $("#loginDialog").close();$("#loginMfaCode").value="";$("#loginMfaDialog").showModal();return;
  }
 }
 await syncUser();$("#loginDialog").close();notice("Connexion réussie.");
});
$("#verifyLoginMfa").addEventListener("click",async()=>{
 if(!pendingMfaFactor?.challengeId)return;
 const code=$("#loginMfaCode").value.trim();
 if(!/^\d{6}$/.test(code)){notice("Saisis le code à 6 chiffres.");return}
 const result=await sb.auth.mfa.verify({factorId:pendingMfaFactor.id,challengeId:pendingMfaFactor.challengeId,code});
 if(result.error){notice("Code incorrect ou expiré.");return}
 pendingMfaFactor=null;await syncUser();$("#loginMfaDialog").close();notice("Connexion sécurisée réussie.");
});
$("#articleForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!user){notice("Connecte-toi pour publier.");return}
 const body=$("#articleBody").value.trim();if(body.length<30){notice("Ajoute au moins 30 caractères.");return}
 const payload={title:$("#articleTitle").value.trim(),category:$("#articleCategory").value,excerpt:$("#articleExcerpt").value.trim()||body.slice(0,135),body:body,author_id:user.id,author_name:user.user_metadata.display_name||user.email.split("@")[0]};
 const r=await sb.from("articles").insert(payload);if(r.error){notice("Erreur : "+r.error.message);return}
 $("#articleDialog").close();category="Tous";query="";$("#searchInput").value="";$("#categorySelect").value="Tous";await load();notice("Article publié pour tous les visiteurs !");
});
$("#resetSearch").addEventListener("click",()=>{query="";category="Tous";$("#searchInput").value="";$("#categorySelect").value="Tous";draw()});
sb.auth.onAuthStateChange((_e,s)=>{user=s?s.user:null;$("#accountEmail").textContent=user?(user.email||"Compte connecté"):""});
(async()=>{await syncUser();await load()})();
