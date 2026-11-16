const sb=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const TERMS_VERSION="1.0";
const $=s=>document.querySelector(s);
let rows=[],user=null,category="Tous",query="",currentEditingId=null,recommendationsLimit=5,adminUsers=[],adminUsersPage=0,adminUsersHasMore=false,adminUsersLoading=false,adminUsersError="";
const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function notice(s){const t=$("#toast");t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500)}
function date(s){return new Date(s).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})}
const READING_KEY="savoir-reading-history-v1";
function getReadingHistory(){try{const value=JSON.parse(localStorage.getItem(READING_KEY)||"[]");return Array.isArray(value)?value:[]}catch{return[]}}
function saveArticleClick(article){
 const history=getReadingHistory(),entry=history.find(x=>x.id===article.id);
 if(entry){entry.count=Math.min(50,(entry.count||1)+1);entry.last=Date.now();entry.category=article.category;entry.title=article.title}
 else history.push({id:article.id,category:article.category,title:article.title,count:1,last:Date.now()});
 try{localStorage.setItem(READING_KEY,JSON.stringify(history.slice(-100)))}catch{}
}
function articleCard(x){return '<article class="article-card" data-id="'+esc(x.id)+'"><div class="article-top"><span class="tag">'+esc(x.category)+'</span><span class="article-date">'+date(x.created_at)+'</span></div><h3>'+esc(x.title)+'</h3><p>'+esc(x.excerpt||x.body.slice(0,115))+'</p><div class="article-bottom"><span>Par '+esc(x.author_name)+'</span><span class="article-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M7 17 17 7M7 7h10v10"/></svg></span></div></article>'}
function renderRecommendations(){
 const panel=$("#recommendations"),grid=$("#recommendationGrid");if(!panel||!grid)return;
 const history=getReadingHistory().filter(h=>rows.some(a=>a.id===h.id));
 if(!history.length){panel.hidden=true;return}
 const categoryWeights={},wordWeights={};
 const stop=new Set(["avec","dans","pour","sans","sous","chez","plus","moins","leur","leurs","elle","elles","nous","vous","être","avoir","tout","tous","une","des","les","aux","sur","par","que","qui","comment","fonctionnement","histoire","article","découvrir"]);
 const words=s=>(String(s||"").toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g,"").match(/[a-z0-9]{4,}/g)||[]).filter(w=>!stop.has(w));
 history.forEach(h=>{
  const age=Math.max(0,(Date.now()-(h.last||Date.now()))/86400000),weight=(h.count||1)*Math.exp(-age/45);
  categoryWeights[h.category]=(categoryWeights[h.category]||0)+weight;
  const article=rows.find(a=>a.id===h.id);
  words((h.title||"")+" "+(article?.excerpt||"")+" "+(article?.body||"").slice(0,500)).forEach(w=>wordWeights[w]=(wordWeights[w]||0)+weight);
 });
 const viewed=new Set(history.map(h=>h.id));
 const ranked=rows.filter(a=>!viewed.has(a.id)).map(a=>{
  let score=5*Math.log1p(categoryWeights[a.category]||0);
  const unique=new Set(words(a.title+" "+a.excerpt+" "+a.body.slice(0,700)));
  unique.forEach(w=>{if(wordWeights[w])score+=Math.min(2,wordWeights[w]*0.7)});
  const age=Math.max(0,(Date.now()-new Date(a.created_at).getTime())/86400000);
  score+=0.25*Math.exp(-age/180);
  return {article:a,score};
 }).sort((a,b)=>b.score-a.score||new Date(b.article.created_at)-new Date(a.article.created_at));
 grid.innerHTML=ranked.slice(0,recommendationsLimit).map(x=>articleCard(x.article)).join("");
 const more=$("#showMoreRecommendations");if(more)more.hidden=ranked.length<=recommendationsLimit;
 panel.hidden=ranked.length===0;
}
function draw(){
 const list=rows.filter(x=>(category==="Tous"||x.category===category)&&(x.title+" "+x.excerpt+" "+x.body+" "+x.category).toLowerCase().includes(query.toLowerCase()));
 const order=$("#sortSelect").value;
 if(order==="title")list.sort((x,y)=>x.title.localeCompare(y.title,"fr"));
 else if(order==="oldest")list.sort((x,y)=>new Date(x.created_at)-new Date(y.created_at));
 else list.sort((x,y)=>new Date(y.created_at)-new Date(x.created_at));
 $("#articleCount").textContent=rows.length;
 $("#contributorCount").textContent=new Set(rows.map(x=>x.author_id).filter(Boolean)).size;
 $("#articleGrid").innerHTML=list.map(articleCard).join("");
 $("#emptyState").hidden=list.length>0;
 renderRecommendations();
}
async function load(){const r=await sb.from("articles").select("*").order("created_at",{ascending:false});if(r.error){notice("Erreur de chargement des articles.");return}rows=r.data||[];draw()}
function isAdmin(){return user?.app_metadata?.role==="admin"}
function updateAuthStatus(){const status=$("#authStatus");if(status){status.textContent=user?"Connecté":"Vous n’êtes pas connecté";status.classList.toggle("is-connected",Boolean(user));}}
function updateAdminMenu(){updateAuthStatus();const item=$("#adminMenuItem");if(item){const visible=Boolean(user&&isAdmin());item.hidden=!visible;item.style.display=visible?"block":"none";item.setAttribute("aria-hidden",String(!visible));}const email=$("#adminAccountEmail");if(email)email.textContent=user?.email||"Compte administrateur"}
function hasAcceptedTerms(u=user){return u?.user_metadata?.terms_version===TERMS_VERSION}
async function requireTermsAcceptance(){if(!user||hasAcceptedTerms())return;const dialog=$("#termsGateDialog");if(!dialog.open)dialog.showModal()}
async function syncUser(){const r=await sb.auth.getUser();user=r.data.user;$("#accountEmail").textContent=user?(user.email||"Compte connecté"):"";updateAdminMenu();await requireTermsAcceptance()}
function renderAdminUsers(){
 if(adminUsersError){$("#adminUsersMessage").hidden=false;$("#adminUsersMessage").textContent=adminUsersError;$("#adminUsersTableWrap").hidden=true;$("#loadMoreAdminUsers").hidden=true;return}
 const term=$("#adminUsersSearch").value.trim().toLowerCase();
 const filtered=adminUsers.filter(u=>(u.display_name+" "+u.email+" "+u.role+" "+u.approval_status).toLowerCase().includes(term));
 const pending=adminUsers.filter(u=>u.approval_status==="pending").length;
 $("#adminUsersCount").textContent=adminUsers.length+" compte"+(adminUsers.length>1?"s":"")+" chargé"+(adminUsers.length>1?"s":"")+(pending?" · "+pending+" demande"+(pending>1?"s":"")+" à valider":"")+(term?" · "+filtered.length+" résultat(s)":"");
 $("#adminUsersTable").innerHTML=filtered.map(u=>{
  const status=u.approval_status||"approved",label=status==="pending"?"En attente d’approbation":status==="rejected"?"Refusé":"Approuvé";
  const admin=u.role==="admin",banned=Boolean(u.banned);
  const actions=admin?"—":'<div class="admin-user-actions">'+
   (status!=="approved"?'<button type="button" class="btn btn-light" data-user-action="approve" data-user-id="'+esc(u.id)+'">Approuver</button>':"")+
   (status==="pending"?'<button type="button" class="btn btn-light" data-user-action="reject" data-user-id="'+esc(u.id)+'">Refuser</button>':"")+
   (status==="approved"?'<button type="button" class="btn '+(banned?"btn-light":"btn-dark")+'" data-user-action="'+(banned?"unban":"ban")+'" data-user-id="'+esc(u.id)+'">'+(banned?"Débannir":"Bannir")+'</button>':"")+
   '</div>';
  const toggles=status==="approved"&&!admin?'<div class="admin-permission-toggles">'+
   '<button type="button" class="permission-toggle '+(u.can_edit_articles?"is-on":"")+'" role="switch" aria-checked="'+String(Boolean(u.can_edit_articles))+'" aria-label="Autoriser la modification" data-user-action="edit-permission" data-permission="can_edit_articles" data-user-id="'+esc(u.id)+'"><span></span></button><span>Modification</span>'+
   '<button type="button" class="permission-toggle '+(u.can_delete_articles?"is-on":"")+'" role="switch" aria-checked="'+String(Boolean(u.can_delete_articles))+'" aria-label="Autoriser la suppression" data-user-action="delete-permission" data-permission="can_delete_articles" data-user-id="'+esc(u.id)+'"><span></span></button><span>Suppression</span>'+
   '</div>':"—";
  return '<tr><td>'+esc(u.display_name||"—")+'</td><td>'+esc(u.email||"—")+'</td><td>'+date(u.created_at)+'</td><td>'+(u.last_sign_in_at?date(u.last_sign_in_at):"Jamais")+'</td><td><span class="admin-role '+(admin?"is-admin":"")+'">'+(admin?"Administrateur":"Membre")+'</span></td><td>'+(u.confirmed?"Confirmé":"E-mail non confirmé")+'</td><td><span class="admin-approval-status '+status+'">'+label+'</span></td><td><span class="admin-ban-status '+(banned?"banned":"active")+'">'+(banned?"Banni":"Actif")+'</span></td><td>'+toggles+'</td><td>'+actions+'</td></tr>';
 }).join("");
 $("#adminUsersTableWrap").hidden=filtered.length===0;
 if(!adminUsersLoading)$("#adminUsersMessage").hidden=filtered.length>0;
 if(!filtered.length&&!adminUsersLoading){$("#adminUsersMessage").hidden=false;$("#adminUsersMessage").textContent=term?"Aucun compte ne correspond à cette recherche.":"Aucun compte trouvé."}
 $("#loadMoreAdminUsers").hidden=!adminUsersHasMore;
}
async function loadAdminUsers(reset=false){
 if(!isAdmin()||adminUsersLoading)return;
 if(reset){adminUsers=[];adminUsersPage=0;adminUsersHasMore=false;adminUsersError=""}
 adminUsersLoading=true;$("#adminUsersMessage").hidden=false;$("#adminUsersMessage").textContent="Chargement des comptes…";$("#refreshAdminUsers").disabled=true;$("#loadMoreAdminUsers").disabled=true;
 try{
  const nextPage=adminUsersPage+1;
  const result=await sb.functions.invoke("admin-users",{body:{page:nextPage,perPage:100}});
  if(result.error)throw result.error;
  if(result.data?.error)throw new Error(result.data.error);
  const incoming=result.data?.users||[];
  adminUsers.push(...incoming);adminUsersPage=nextPage;adminUsersHasMore=Boolean(result.data?.hasMore);adminUsersError="";
  $("#adminUsersMessage").hidden=true;renderAdminUsers();
 }catch(error){
  console.error("Erreur de chargement des comptes :",error);
  adminUsersError="Impossible de charger les comptes : "+(error.message||"erreur inconnue")+".";$("#adminUsersMessage").hidden=false;$("#adminUsersMessage").textContent=adminUsersError;
 }finally{adminUsersLoading=false;$("#refreshAdminUsers").disabled=false;$("#loadMoreAdminUsers").disabled=false;renderAdminUsers()}
}
$("#adminUsersSearch").addEventListener("input",renderAdminUsers);
$("#refreshAdminUsers").addEventListener("click",()=>loadAdminUsers(true));
$("#loadMoreAdminUsers").addEventListener("click",()=>loadAdminUsers(false));

$("#adminUsersTable").addEventListener("click",async e=>{
 const button=e.target.closest("[data-user-action]");if(!button)return;
 if(!isAdmin())return;
 const action=button.dataset.userAction,id=button.dataset.userId;
 const prompts={approve:"Approuver ce compte ?",reject:"Refuser cette inscription ?",ban:"Bannir ce compte ? La personne ne pourra plus se connecter.",unban:"Débannir ce compte ?","edit-permission":"Modifier le droit de modification ?","delete-permission":"Modifier le droit de suppression ?"};
 if(!confirm(prompts[action]||"Confirmer cette action ?"))return;
 button.disabled=true;
 try{
  let payload={action,userId:id};
  if(action==="edit-permission"||action==="delete-permission"){
   const target=adminUsers.find(u=>u.id===id);if(!target)throw new Error("Compte introuvable.");
   const permission=button.dataset.permission;
   payload={action:"permissions",userId:id,canEdit:permission==="can_edit_articles"?!target.can_edit_articles:target.can_edit_articles,canDelete:permission==="can_delete_articles"?!target.can_delete_articles:target.can_delete_articles};
  }
  const result=await sb.functions.invoke("admin-users",{body:payload});
  if(result.error)throw result.error;
  if(result.data?.error)throw new Error(result.data.error);
  await loadAdminUsers(true);
  const messages={approve:"Compte approuvé : la personne peut maintenant se connecter.",reject:"Inscription refusée.",ban:"Compte banni.",unban:"Compte débanni.","edit-permission":"Droit de modification mis à jour.","delete-permission":"Droit de suppression mis à jour."};
  notice(messages[action]||"Modification enregistrée.");
 }catch(error){notice("Action impossible : "+(error.message||"erreur inconnue"));button.disabled=false}
});
function openWrite(){if(!user){$("#loginDialog").showModal();notice("Connecte-toi pour publier.");return}currentEditingId=null;$("#articleForm").reset();$("#articleDialog").querySelector("h2").textContent="Créer un article";$("#articleForm").querySelector('button[type="submit"]').textContent="Publier l'article ↗";$("#articleDialog").showModal()}
function read(id){
 const a=rows.find(x=>x.id===id);if(!a)return;
 const ownsArticle=Boolean(user&&user.id===a.author_id);
 const canEdit=Boolean(user&&(ownsArticle||isAdmin()||user.app_metadata?.can_edit_articles===true));
 const canDelete=Boolean(user&&(ownsArticle||isAdmin()||user.app_metadata?.can_delete_articles===true));
 const controls=canEdit||canDelete?'<div class="read-actions">'+(canEdit?'<button type="button" class="btn btn-light" data-article-action="edit" data-article-id="'+esc(a.id)+'">Modifier</button>':"")+(canDelete?'<button type="button" class="btn btn-light" data-article-action="delete" data-article-id="'+esc(a.id)+'">Supprimer</button>':"")+'</div>':"";
 $("#readContent").innerHTML='<span class="tag">'+esc(a.category)+'</span><h1 class="read-title">'+esc(a.title)+'</h1><div class="read-meta">Par '+esc(a.author_name)+' · '+date(a.created_at)+'</div><div class="read-body">'+esc(a.body)+'</div>'+controls;$("#readDialog").showModal()
}
$("#searchInput").addEventListener("input",e=>{query=e.target.value;draw()});
$("#sortSelect").addEventListener("change",draw);
$("#categorySelect").addEventListener("change",e=>{category=e.target.value;draw()});
document.addEventListener("click",async e=>{
 const action=e.target.closest("[data-article-action]");
 if(action){
  const id=action.dataset.articleId,kind=action.dataset.articleAction,a=rows.find(x=>x.id===id);
  if(!a||!user){notice("Connecte-toi pour gérer cet article.");return}
  const ownsArticle=a.author_id===user.id;
  const mayEdit=ownsArticle||isAdmin()||user.app_metadata?.can_edit_articles===true;
  const mayDelete=ownsArticle||isAdmin()||user.app_metadata?.can_delete_articles===true;
  if(kind==="edit"&&!mayEdit){notice("Tu n’as pas le droit de modifier cet article.");return}
  if(kind==="delete"&&!mayDelete){notice("Tu n’as pas le droit de supprimer cet article.");return}
  if(kind==="edit"){
   currentEditingId=id;$("#articleTitle").value=a.title;$("#articleCategory").value=a.category;$("#articleExcerpt").value=a.excerpt||"";$("#articleBody").value=a.body;
   $("#articleDialog").querySelector("h2").textContent="Modifier un article";$("#articleForm").querySelector('button[type="submit"]').textContent="Enregistrer les modifications";
   $("#readDialog").close();$("#articleDialog").showModal();return;
  }
  if(kind==="delete"){
   if(!confirm("Supprimer définitivement cet article ?"))return;
   const result=await sb.from("articles").delete().eq("id",id).select("id").maybeSingle();
   if(result.error){notice("Suppression impossible : "+result.error.message);return}
   if(!result.data){notice("Article introuvable ou action non autorisée.");return}
   $("#readDialog").close();await load();notice("Article supprimé.");return;
  }
 }
 const card=e.target.closest(".article-card");if(card){const article=rows.find(x=>x.id===card.dataset.id);if(article){saveArticleClick(article);renderRecommendations();read(card.dataset.id)}}
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
 if(action==="admin"){if(!isAdmin()){notice("Accès réservé aux administrateurs.");return}$("#adminAccountEmail").textContent=user.email||"Compte administrateur";$("#adminDialog").showModal();if(!adminUsers.length)loadAdminUsers(true)}
});
const applyTheme=theme=>{
 const selected=["light","dark","oled","christmas"].includes(theme)?theme:"light";
 if(selected==="light")delete document.body.dataset.theme;else document.body.dataset.theme=selected;
 localStorage.setItem("savoir-theme",selected);
 document.querySelectorAll("[data-theme-choice]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.themeChoice===selected)));
 document.querySelector('meta[name="theme-color"]')?.setAttribute("content",selected==="oled"?"#000000":selected==="dark"?"#171a17":selected==="christmas"?"#24563c":"#fafaf8");
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

$("#accountLogout").addEventListener("click",async()=>{const r=await sb.auth.signOut();if(r.error){notice("Impossible de se déconnecter.");return}user=null;$("#accountDialog").close();notice("Déconnecté.")});
$("#authMode").addEventListener("change",e=>{const yes=e.target.value==="signup";$("#displayNameWrap").hidden=!yes;$("#termsAcceptanceWrap").hidden=!yes;$("#termsAccepted").required=yes;if(!yes)$("#termsAccepted").checked=false;$("#forgotPassword").hidden=yes;$("#loginTitle").textContent=yes?"Créer un compte":"Connexion";$("#authSubmit").textContent=yes?"Créer mon compte":"Se connecter"});
$("#openTerms").addEventListener("click",()=>$("#termsDialog").showModal());
$("#reviewTerms").addEventListener("click",()=>$("#termsDialog").showModal());
$("#termsGateDialog").addEventListener("cancel",e=>e.preventDefault());
$("#acceptTerms").addEventListener("click",async()=>{
 const button=$("#acceptTerms");button.disabled=true;button.textContent="Enregistrement…";
 try{
  const {data,error}=await sb.auth.updateUser({data:{...(user?.user_metadata||{}),terms_version:TERMS_VERSION,terms_accepted_at:new Date().toISOString()}});
  if(error)throw error;
  user=data.user;updateAdminMenu();$("#termsGateDialog").close();notice("Conditions acceptées. Bienvenue sur Savoir !");
 }catch(error){notice("Impossible d’enregistrer ton acceptation : "+(error?.message||"réessaie."));}
 finally{button.disabled=false;button.textContent="J’accepte les conditions"}
});
$("#forgotPassword").addEventListener("click",async()=>{
 const email=$("#email").value.trim();
 if(!email){notice("Saisis d’abord l’adresse e-mail de ton compte.");$("#email").focus();return}
 const button=$("#forgotPassword");button.disabled=true;button.textContent="Envoi…";
 try{
  const redirectTo=window.location.origin+window.location.pathname;
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo});
  if(error)throw error;
  $("#loginDialog").close();notice("Si un compte existe pour cette adresse, un e-mail de réinitialisation va être envoyé.");
 }catch(error){notice("Impossible d’envoyer l’e-mail : "+(error?.message||"réessaie plus tard."));}
 finally{button.disabled=false;button.textContent="Mot de passe oublié ?"}
});
$("#passwordRecoveryForm").addEventListener("submit",async e=>{
 e.preventDefault();const password=$("#recoveryNewPassword").value;
 if(password.length<8){notice("Le mot de passe doit contenir au moins 8 caractères.");return}
 const button=$("#saveRecoveryPassword");button.disabled=true;button.textContent="Enregistrement…";
 try{
  const {error}=await sb.auth.updateUser({password});if(error)throw error;
  $("#passwordRecoveryDialog").close();$("#recoveryNewPassword").value="";await syncUser();notice("Mot de passe modifié. Tu peux maintenant te connecter.");
 }catch(error){notice("Impossible de modifier le mot de passe : "+(error?.message||"le lien est peut-être expiré."));}
 finally{button.disabled=false;button.textContent="Enregistrer le mot de passe"}
});
$("#loginForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const button=$("#authSubmit"), original=button.textContent;
 button.disabled=true;button.textContent="Connexion…";
 try{
  const email=$("#email").value.trim(),password=$("#password").value,signup=$("#authMode").value==="signup";let r;
  if(signup){
   const name=$("#displayName").value.trim();
   if(!name){notice("Saisis un pseudo.");return}
   if(!$("#termsAccepted").checked){notice("Tu dois accepter les conditions d’utilisation pour créer un compte.");return}r=await sb.auth.signUp({email,password,options:{data:{display_name:name,terms_version:TERMS_VERSION,terms_accepted_at:new Date().toISOString()}}});
  }else r=await sb.auth.signInWithPassword({email,password});
  if(r.error){if(r.error.code==="user_banned")notice("Ton compte est en attente d’approbation par l’administrateur.");else notice("Connexion impossible : "+r.error.message);return}
  if(signup){if(r.data.session)await sb.auth.signOut({scope:"local"});$("#loginDialog").close();notice("Demande d’inscription envoyée. Confirme ton e-mail si demandé ; ton compte sera utilisable après approbation par l’administrateur.");return}
  user=r.data.user;
  if(!signup){
   const factors=await sb.auth.mfa.listFactors();
   if(factors.error)throw factors.error;
   const factor=(factors.data?.totp||[]).find(x=>x.status==="verified");
   if(factor){
    const challenge=await sb.auth.mfa.challenge({factorId:factor.id});
    if(challenge.error)throw challenge.error;
    pendingMfaFactor={id:factor.id,challengeId:challenge.data.id};
    $("#loginDialog").close();$("#loginMfaCode").value="";$("#loginMfaDialog").showModal();return;
   }
  }
  $("#loginDialog").close();await syncUser();if(hasAcceptedTerms())notice("Connexion réussie.");
 }catch(error){
  console.error("Erreur de connexion Savoir :",error);
  notice("Erreur de connexion : "+(error?.message||"réessaie dans quelques instants."));
 }finally{
  button.disabled=false;button.textContent=original;
 }
});
$("#verifyLoginMfa").addEventListener("click",async()=>{
 if(!pendingMfaFactor?.challengeId)return;
 const code=$("#loginMfaCode").value.trim();
 if(!/^\d{6}$/.test(code)){notice("Saisis le code à 6 chiffres.");return}
 const result=await sb.auth.mfa.verify({factorId:pendingMfaFactor.id,challengeId:pendingMfaFactor.challengeId,code});
 if(result.error){notice("Code incorrect ou expiré.");return}
 pendingMfaFactor=null;$("#loginMfaDialog").close();await syncUser();if(hasAcceptedTerms())notice("Connexion sécurisée réussie.");
});
$("#articleForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!user){notice("Connecte-toi pour publier.");return}
 const body=$("#articleBody").value.trim();if(body.length<30){notice("Ajoute au moins 30 caractères.");return}
 const payload={title:$("#articleTitle").value.trim(),category:$("#articleCategory").value,excerpt:$("#articleExcerpt").value.trim()||body.slice(0,135),body:body};
 let r;
 if(currentEditingId){
  r=await sb.from("articles").update(payload).eq("id",currentEditingId).select("id").maybeSingle();
  if(r.error){notice("Modification impossible : "+r.error.message);return}
  if(!r.data){notice("Article introuvable ou tu n’en es pas l’auteur.");return}
 }else{
  r=await sb.from("articles").insert({...payload,author_id:user.id,author_name:user.user_metadata.display_name||user.email.split("@")[0]});
  if(r.error){notice("Erreur : "+r.error.message);return}
 }
 const wasEditing=Boolean(currentEditingId);currentEditingId=null;$("#articleDialog").close();category="Tous";query="";$("#searchInput").value="";$("#categorySelect").value="Tous";await load();notice(wasEditing?"Article modifié !":"Article publié pour tous les visiteurs !");
});
$("#resetSearch").addEventListener("click",()=>{query="";category="Tous";$("#searchInput").value="";$("#categorySelect").value="Tous";draw()});
$("#showMoreRecommendations").addEventListener("click",()=>{recommendationsLimit+=5;renderRecommendations()});
$("#resetRecommendations").addEventListener("click",()=>{try{localStorage.removeItem(READING_KEY)}catch{}renderRecommendations();notice("Tes recommandations ont été réinitialisées.")});
sb.auth.onAuthStateChange((event,s)=>{user=s?s.user:null;$("#accountEmail").textContent=user?(user.email||"Compte connecté"):"";updateAdminMenu();if(event==="PASSWORD_RECOVERY")$("#passwordRecoveryDialog").showModal()});
(async()=>{await syncUser();await load()})();
