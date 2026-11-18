const sb=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY,{auth:{flowType:"pkce",detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});
const TERMS_VERSION="1.0";
const $=s=>document.querySelector(s);
let rows=[],user=null,category="Tous",query="",currentEditingId=null,recommendationsLimit=5,allArticlesView=window.location.hash==="#articles",adminUsers=[],adminUsersPage=0,adminUsersHasMore=false,adminUsersLoading=false,adminUsersError="",adminContributions=[],adminContributionsLoading=false,adminContributionsError="",recoveryLinkPending=new URLSearchParams(window.location.search).has("code")||new URLSearchParams(window.location.hash.slice(1)).get("type")==="recovery";
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
 const candidates=history.length?rows.filter(a=>!viewed.has(a.id)):rows.slice();
 const ranked=(candidates.length?candidates:rows.slice()).map(a=>{
  let score=5*Math.log1p(categoryWeights[a.category]||0);
  const unique=new Set(words(a.title+" "+a.excerpt+" "+a.body.slice(0,700)));
  unique.forEach(w=>{if(wordWeights[w])score+=Math.min(2,wordWeights[w]*0.7)});
  const age=Math.max(0,(Date.now()-new Date(a.created_at).getTime())/86400000);
  score+=0.25*Math.exp(-age/180);
  return {article:a,score};
 }).sort((a,b)=>b.score-a.score||new Date(b.article.created_at)-new Date(a.article.created_at));
 grid.innerHTML=ranked.slice(0,6).map(x=>articleCard(x.article)).join("");
 const more=$("#showMoreRecommendations");if(more)more.hidden=allArticlesView||rows.length<=6;
 panel.hidden=allArticlesView;
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
 $("#articleGrid").hidden=!allArticlesView;
 $("#emptyState").hidden=!allArticlesView||list.length>0;
 const toolbar=$("#allArticlesToolbar");
 document.body.classList.toggle("all-articles-view",allArticlesView);
 const topbarSlot=$("#topbarSearchSlot"),searchForm=$("#searchForm"),heroCopy=document.querySelector(".hero-copy"),stats=heroCopy?.querySelector(".stats");
 if(allArticlesView){
  if(searchForm&&topbarSlot&&searchForm.parentElement!==topbarSlot)topbarSlot.appendChild(searchForm);
  if(topbarSlot)topbarSlot.hidden=false;
  if(toolbar){toolbar.hidden=false;if(!$("#backToRecommendations"))toolbar.innerHTML='<button type="button" class="btn btn-light" id="backToRecommendations">← Retour à l’accueil</button>';}
  const heading=document.querySelector("#articles .section-heading");
  if(heading&&!heading.querySelector("h2")){const title=document.createElement("h2");title.textContent="Tous les articles";heading.prepend(title);}
 }else{
  if(searchForm&&heroCopy&&stats&&searchForm.parentElement!==heroCopy)heroCopy.insertBefore(searchForm,stats);
  if(topbarSlot)topbarSlot.hidden=true;
  if(toolbar)toolbar.hidden=true;
  document.querySelector("#articles .section-heading h2")?.remove();
 }
 const controls=document.querySelector(".sort-controls");if(controls)controls.hidden=!allArticlesView;
 renderRecommendations();
}
async function load(){const r=await sb.from("articles").select("*").order("created_at",{ascending:false});if(r.error){notice("Erreur de chargement des articles.");return}rows=r.data||[];draw()}
const NOTIFICATION_READ_KEY="savoir-notifications-read-v1";
let siteNotifications=[],notificationChannel=null;
function notificationReadIds(){try{return JSON.parse(localStorage.getItem(NOTIFICATION_READ_KEY+"-"+user.id)||"[]")}catch{return[]}}
function renderNotifications(){
 const list=$("#notificationList"),badge=$("#notificationBadge");
 if(!user){list.innerHTML='<p class="notification-empty">Connecte-toi pour voir tes notifications.</p>';badge.hidden=true;$("#notificationToggle").setAttribute("aria-label","Notifications");return}
 const unread=siteNotifications.filter(n=>!n.read).length;
 badge.hidden=unread===0;badge.textContent=unread>99?"99+":String(unread);
 $("#notificationToggle").setAttribute("aria-label",unread?("Notifications, "+unread+" non lue"+(unread>1?"s":"")):"Notifications");
 if(!siteNotifications.length){list.innerHTML='<p class="notification-empty">Aucune notification pour le moment.</p>';return}
 list.innerHTML=siteNotifications.map(n=>'<article class="notification-item '+(n.read?"is-read":"is-unread")+'" role="button" tabindex="0" data-notification-id="'+esc(n.id)+'" data-notification-source="'+n.source+'" '+(n.ticket_id?'data-ticket-id="'+esc(n.ticket_id)+'"':'')+'><span class="notification-dot"></span><div><strong>'+esc(n.title)+'</strong><p>'+esc(n.message)+'</p><time>'+date(n.created_at)+'</time></div></article>').join("");
}
async function loadNotifications(){
 if(!user){siteNotifications=[];renderNotifications();return}
 try{
  const [tickets,contributions]=await Promise.all([
   sb.from("notifications").select("id,title,message,notification_type,ticket_id,created_at,read_at").order("created_at",{ascending:false}).limit(50),
   (async()=>{let q=sb.from("article_submissions").select("id,title,status,submission_type,created_at,reviewed_at,author_id");q=isAdmin()?q.or("status.eq.pending,author_id.eq."+user.id):q.eq("author_id",user.id);return await q.order("created_at",{ascending:false}).limit(30)})()
  ]);
  if(tickets.error)throw tickets.error;
  if(contributions.error)throw contributions.error;
  const readIds=new Set(notificationReadIds());
  const ticketItems=(tickets.data||[]).map(n=>({...n,source:"ticket",read:Boolean(n.read_at)}));
  const contributionItems=(contributions.data||[]).map(s=>{
   const pending=s.status==="pending";
   return {id:s.id,source:"contribution",ticket_id:null,read:readIds.has(s.id),title:pending?(isAdmin()?"Contribution à valider":"Contribution envoyée"):(s.status==="approved"?"Contribution approuvée":"Contribution refusée"),message:pending?(isAdmin()?"Un article attend ta validation : "+s.title:"Ta contribution « "+s.title+" » est en attente de validation."):(s.status==="approved"?"Ta contribution « "+s.title+" » a été approuvée et publiée.":"Ta contribution « "+s.title+" » n’a pas été retenue."),created_at:s.reviewed_at||s.created_at};
  });
  siteNotifications=[...ticketItems,...contributionItems].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,60);
 }catch(error){console.error("Chargement des notifications impossible :",error);siteNotifications=[]}
 renderNotifications();
}
async function markNotificationsRead(){
 if(!user)return;
 const unreadTickets=siteNotifications.filter(n=>n.source==="ticket"&&!n.read).map(n=>n.id);
 const contributionIds=siteNotifications.filter(n=>n.source==="contribution").map(n=>n.id);
 try{
  if(unreadTickets.length){const r=await sb.from("notifications").update({read_at:new Date().toISOString()}).in("id",unreadTickets);if(r.error)throw r.error}
  localStorage.setItem(NOTIFICATION_READ_KEY+"-"+user.id,JSON.stringify([...new Set([...notificationReadIds(),...contributionIds])]));
  await loadNotifications();
 }catch(error){notice("Impossible de marquer les notifications comme lues : "+(error.message||"erreur inconnue"))}
}
async function markOneNotificationRead(n){
 if(!n||n.read)return;
 if(n.source==="ticket"){
  const r=await sb.from("notifications").update({read_at:new Date().toISOString()}).eq("id",n.id);
  if(r.error)throw r.error;
 }else{
  localStorage.setItem(NOTIFICATION_READ_KEY+"-"+user.id,JSON.stringify([...new Set([...notificationReadIds(),n.id])]));
 }
 await loadNotifications();
}
function subscribeNotifications(){
 if(notificationChannel){sb.removeChannel(notificationChannel);notificationChannel=null}
 if(!user)return;
 notificationChannel=sb.channel("user-notifications-"+user.id)
  .on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:"user_id=eq."+user.id},payload=>{
   loadNotifications();
   const incoming=payload.new;
   if(incoming?.title)notice(incoming.title);
  }).subscribe();
}
async function openTicketFromNotification(n){
 if(!n?.ticket_id)return;
 if(isAdmin()){
  if(!$("#adminDialog").open)$("#adminDialog").showModal();
  await loadAdminHelpRequests();
  const card=Array.from($("#adminHelpList").querySelectorAll("[data-ticket-card]")).find(x=>x.dataset.ticketCard===n.ticket_id);
  if(card){const button=card.querySelector("[data-help-thread]");if(button)await openHelpThread(n.ticket_id,card,true,button);card.scrollIntoView({behavior:"smooth",block:"center"})}
 }else{
  if(!$("#helpDialog").open)$("#helpDialog").showModal();
  await loadMyHelpRequests();
  const card=Array.from($("#myHelpRequestsList").querySelectorAll("[data-ticket-card]")).find(x=>x.dataset.ticketCard===n.ticket_id);
  if(card){const button=card.querySelector("[data-help-thread]");if(button)await openHelpThread(n.ticket_id,card,false,button);card.scrollIntoView({behavior:"smooth",block:"center"})}
 }
}
async function handleNotificationOpen(item){
 const n=siteNotifications.find(x=>x.id===item.dataset.notificationId);
 if(!n)return;
 try{await markOneNotificationRead(n);if(n.source==="ticket")await openTicketFromNotification(n)}
 catch(error){notice("Impossible d’ouvrir la notification : "+(error.message||"erreur inconnue"))}
}
function isAdmin(){return user?.app_metadata?.role==="admin"}
function updateAdminMenu(){const item=$("#adminMenuItem");if(item){const visible=Boolean(user&&isAdmin());item.hidden=!visible;item.style.display=visible?"block":"none";item.setAttribute("aria-hidden",String(!visible));}const email=$("#adminAccountEmail");if(email)email.textContent=user?.email||"Compte administrateur"}
function hasAcceptedTerms(u=user){return u?.user_metadata?.terms_version===TERMS_VERSION}
async function requireTermsAcceptance(){if(!user||hasAcceptedTerms())return;const dialog=$("#termsGateDialog");if(!dialog.open)dialog.showModal()}
function showWelcomeGreeting(u=user){const heading=$("#welcomeHeading");if(!heading)return;heading.style.fontSize="";if(!u){heading.textContent="Le savoir se partage.";return}const name=String(u.user_metadata?.display_name||u.email?.split("@")[0]||"membre").trim();heading.textContent="Ravis de vous revoir "+name;requestAnimationFrame(()=>{const available=heading.parentElement?.clientWidth||0;const base=parseFloat(getComputedStyle(heading).fontSize)||70;const needed=heading.scrollWidth;if(available>0&&needed>available)heading.style.fontSize=Math.max(12,base*available/needed*0.96)+"px"})}
async function syncUser(){const r=await sb.auth.getUser();user=r.data.user;$("#accountEmail").textContent=user?(user.email||"Compte connecté"):"";updateAdminMenu();if(user){showWelcomeGreeting(user);const gate=$("#loginDialog");if(gate.open)gate.close();await requireTermsAcceptance();await load();subscribeNotifications();await loadNotifications()}else if(!recoveryLinkPending){greetedUserId=null;const gate=$("#loginDialog");if(!gate.open)gate.showModal()}}
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
   (status==="approved"?'<button type="button" class="btn btn-light" data-user-action="promote" data-user-id="'+esc(u.id)+'">Promouvoir admin</button>':"")+
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
 const prompts={approve:"Approuver ce compte ?",reject:"Refuser cette inscription ?",ban:"Bannir ce compte ? La personne ne pourra plus se connecter.",unban:"Débannir ce compte ?",promote:"Promouvoir cette personne administrateur ? Elle aura accès à tout le panneau admin.","edit-permission":"Modifier le droit de modification ?","delete-permission":"Modifier le droit de suppression ?"};
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
  const messages={approve:"Compte approuvé : la personne peut maintenant se connecter.",reject:"Inscription refusée.",ban:"Compte banni.",unban:"Compte débanni.",promote:"Cette personne est maintenant administratrice.","edit-permission":"Droit de modification mis à jour.","delete-permission":"Droit de suppression mis à jour."};
  notice(messages[action]||"Modification enregistrée.");
 }catch(error){notice("Action impossible : "+(error.message||"erreur inconnue"));button.disabled=false}
});
async function loadAdminContributions(){
 if(!isAdmin()||adminContributionsLoading)return;
 adminContributionsLoading=true;
 $("#adminContributionsMessage").hidden=false;$("#adminContributionsMessage").textContent="Chargement des contributions…";
 $("#refreshAdminContributions").disabled=true;
 try{
  const result=await sb.from("article_submissions").select("*").eq("status","pending").order("created_at",{ascending:true});
  if(result.error)throw result.error;
  adminContributions=result.data||[];adminContributionsError="";
  renderAdminContributions();
 }catch(error){
  console.error("Erreur de chargement des contributions :",error);
  adminContributionsError="Impossible de charger les contributions : "+(error.message||"erreur inconnue")+".";
  $("#adminContributionsMessage").hidden=false;$("#adminContributionsMessage").textContent=adminContributionsError;
  $("#adminContributionsList").innerHTML="";
 }finally{
  adminContributionsLoading=false;$("#refreshAdminContributions").disabled=false;
 }
}
function renderAdminContributions(){
 const count=adminContributions.length;
 $("#adminContributionsCount").textContent=count+" contribution"+(count>1?"s":"")+" en attente";
 $("#adminContributionsMessage").hidden=count>0;
 if(!count&&!adminContributionsError)$("#adminContributionsMessage").textContent="Aucune contribution à valider pour le moment.";
 $("#adminContributionsList").innerHTML=adminContributions.map(s=>
  '<article class="admin-submission-card">'+
   '<div class="admin-submission-top"><span class="tag">'+(s.submission_type==="edit"?"Modification":"Nouvel article")+'</span><span class="admin-submission-date">'+date(s.created_at)+'</span></div>'+
   '<h4>'+esc(s.title)+'</h4><p class="admin-submission-meta">'+esc(s.category)+' · Par '+esc(s.author_name)+'</p>'+
   '<p class="admin-submission-excerpt">'+esc(s.excerpt)+'</p>'+
   '<details class="admin-submission-details"><summary>Lire le contenu complet</summary><div class="admin-submission-body">'+esc(s.body)+'</div></details>'+
   '<div class="admin-submission-actions"><button type="button" class="btn btn-dark" data-contribution-action="approve" data-submission-id="'+esc(s.id)+'">Approuver et publier</button><button type="button" class="btn btn-light" data-contribution-action="reject" data-submission-id="'+esc(s.id)+'">Refuser</button></div>'+
  '</article>'
 ).join("");
}
$("#refreshAdminContributions").addEventListener("click",()=>loadAdminContributions());
$("#adminContributionsList").addEventListener("click",async e=>{
 const button=e.target.closest("[data-contribution-action]");if(!button||!isAdmin())return;
 const action=button.dataset.contributionAction,submission=adminContributions.find(x=>x.id===button.dataset.submissionId);
 if(!submission)return;
 let publishedArticleId=submission.article_id;
 if(!confirm(action==="approve"?"Approuver et publier cette contribution ?":"Refuser cette contribution ?"))return;
 button.disabled=true;
 try{
  if(action==="approve"){
   if(submission.submission_type==="edit"){
    const update=await sb.from("articles").update({title:submission.title,category:submission.category,excerpt:submission.excerpt,body:submission.body}).eq("id",submission.article_id).select("id").maybeSingle();
    if(update.error)throw update.error;
    if(!update.data)throw new Error("L’article d’origine est introuvable ou inaccessible.");
   }else{
    publishedArticleId=publishedArticleId||crypto.randomUUID();
    const exists=await sb.from("articles").select("id").eq("id",publishedArticleId).maybeSingle();
    if(exists.error)throw exists.error;
    if(!exists.data){
     const publish=await sb.from("articles").insert({id:publishedArticleId,title:submission.title,category:submission.category,excerpt:submission.excerpt,body:submission.body,author_id:submission.author_id,author_name:submission.author_name}).select("id").single();
     if(publish.error)throw publish.error;
    }
   }
  }
  const reviewUpdate={status:action==="approve"?"approved":"rejected",reviewed_at:new Date().toISOString(),reviewed_by:user.id};
  if(action==="approve"&&submission.submission_type==="new")reviewUpdate.article_id=publishedArticleId;
  const reviewed=await sb.from("article_submissions").update(reviewUpdate).eq("id",submission.id).eq("status","pending").select("id").maybeSingle();
  if(reviewed.error)throw reviewed.error;
  if(!reviewed.data)throw new Error("Cette contribution a déjà été traitée.");
  await loadAdminContributions();
  if(action==="approve")await load();
  notice(action==="approve"?"Contribution approuvée et publiée !":"Contribution refusée.");
 }catch(error){
  notice("Action impossible : "+(error.message||"erreur inconnue"));
  button.disabled=false;
 }
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
const searchCount=$("#searchResultCount");
$("#searchInput").addEventListener("input",e=>{
 const term=e.currentTarget.value.trim().toLocaleLowerCase("fr");
 const count=term?rows.filter(a=>(category==="Tous"||a.category===category)&&(a.title+" "+a.excerpt+" "+a.body+" "+a.category).toLocaleLowerCase("fr").includes(term)).length:rows.length;
 if(searchCount)searchCount.textContent=term?count+" résultat"+(count>1?"s":""):"";
});
function openAllArticlesView(){
 query=$("#searchInput").value.trim();
 allArticlesView=true;
 draw();
 if(window.location.hash!=="#articles")history.pushState({view:"articles",query},"","#articles");
 window.scrollTo({top:0,behavior:"smooth"});
}
$("#searchForm").addEventListener("submit",e=>{
 e.preventDefault();
 openAllArticlesView();
});
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
document.querySelector(".brand")?.addEventListener("click",e=>{
 e.preventDefault();
 if(allArticlesView){allArticlesView=false;query="";$("#searchInput").value="";draw();}
 history.pushState({view:"home"},"",window.location.pathname+window.location.search);
 window.scrollTo({top:0,behavior:"smooth"});
});
function syncArticlesRoute(){
 const showArticles=window.location.hash==="#articles";
 allArticlesView=showArticles;
 if(!showArticles){query="";$("#searchInput").value="";}
 draw();
}
window.addEventListener("popstate",syncArticlesRoute);
window.addEventListener("hashchange",syncArticlesRoute);
const menuToggle=$("#menuToggle"),menuDropdown=$("#menuDropdown");
menuToggle.addEventListener("click",()=>{const open=menuDropdown.hidden;menuDropdown.hidden=!open;menuToggle.setAttribute("aria-expanded",String(open))});
document.addEventListener("click",e=>{if(!e.target.closest(".menu-wrap")){menuDropdown.hidden=true;menuToggle.setAttribute("aria-expanded","false")}});
menuDropdown.addEventListener("click",async e=>{
 const action=e.target.closest("[data-menu-action]")?.dataset.menuAction;
 if(!action)return;
 menuDropdown.hidden=true;menuToggle.setAttribute("aria-expanded","false");
 if(action==="settings")$("#settingsDialog").showModal();
 if(action==="help"){ $("#helpDialog").showModal();loadMyHelpRequests(); }
 if(action==="account"){if(user){$("#accountEmail").textContent=user.email||"Compte connecté";$("#accountUsername").value=user.user_metadata?.display_name||"";$("#accountNewEmail").value="";$("#accountNewPassword").value="";$("#mfaEnrollBox").hidden=true;await refreshMfa();$("#accountDialog").showModal()}else $("#loginDialog").showModal()}
 if(action==="contribution")openWrite();
 if(action==="admin"){if(!isAdmin()){notice("Accès réservé aux administrateurs.");return}$("#adminAccountEmail").textContent=user.email||"Compte administrateur";$("#adminDialog").showModal();if(!adminUsers.length)loadAdminUsers(true);loadAdminContributions();loadAdminHelpRequests()}
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

async function openHelpThread(ticketId,card,adminView,button){
 const current=card.querySelector(".help-thread");
 if(current){current.remove();if(button)button.textContent="Voir la conversation";return}
 const thread=document.createElement("div");thread.className="help-thread";thread.textContent="Chargement de la conversation…";card.append(thread);
 if(button)button.textContent="Masquer la conversation";
 try{
  const ticketResult=await sb.from("help_requests").select("id,user_id,user_name,message,created_at,status").eq("id",ticketId).single();
  if(ticketResult.error)throw ticketResult.error;
  const ticket=ticketResult.data;
  const result=await sb.from("help_request_messages").select("id,sender_id,message,created_at").eq("help_request_id",ticketId).order("created_at",{ascending:true});
  if(result.error)throw result.error;
  const messages=[{sender_id:ticket.user_id,message:ticket.message,created_at:ticket.created_at,initial:true},...(result.data||[])];
  thread.innerHTML='<div class="help-thread-messages">'+messages.map(m=>{
   const fromMember=m.sender_id===ticket.user_id;
   const author=fromMember?(adminView?esc(ticket.user_name||"Membre"):"Toi"):"Administration";
   return '<article class="help-chat-message '+(fromMember?"from-member":"from-admin")+'"><div class="help-chat-meta"><strong>'+author+'</strong><time>'+new Date(m.created_at).toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short"})+'</time></div><p>'+esc(m.message)+'</p></article>';
  }).join("")+'</div>'+
  (adminView||ticket.status==="pending"?'<form class="help-reply-form" data-help-reply-form data-ticket-id="'+esc(ticketId)+'"><label for="helpReply-'+esc(ticketId)+'">Répondre au ticket</label><textarea id="helpReply-'+esc(ticketId)+'" name="message" rows="3" maxlength="2000" minlength="1" required placeholder="Écris ton message…"></textarea><button type="submit" class="btn btn-dark">Envoyer la réponse</button></form>':'<p class="help-thread-closed">Ce ticket est clôturé. Tu ne peux plus envoyer de message.</p>');
 }catch(error){thread.textContent="Impossible de charger la conversation : "+(error.message||"erreur inconnue");}
}
async function loadMyHelpRequests(){
 const message=$("#myHelpRequestsMessage"),list=$("#myHelpRequestsList");
 if(!message||!list)return;
 if(!user){message.textContent="Connecte-toi pour retrouver tes tickets.";list.innerHTML="";return}
 message.hidden=false;message.textContent="Chargement de tes demandes…";
 try{
  const result=await sb.from("help_requests").select("id,ticket_number,subject,status,created_at,message,user_id,user_name").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);
  if(result.error)throw result.error;
  const requests=result.data||[];
  message.hidden=requests.length>0;
  if(!requests.length)message.textContent="Tu n’as pas encore envoyé de demande d’aide.";
  list.innerHTML=requests.map(r=>'<article class="admin-submission-card" data-ticket-card="'+esc(r.id)+'"><div class="admin-submission-top"><span class="tag">'+(r.status==="pending"?"En attente":"Traitée")+'</span><span class="admin-submission-date">'+date(r.created_at)+'</span></div><p class="admin-submission-meta"><strong>Ticket n° '+esc(r.ticket_number||"Non attribué")+'</strong></p><h4>'+esc(r.subject)+'</h4><div class="admin-submission-actions"><button type="button" class="btn btn-light" data-help-thread="'+esc(r.id)+'">Voir la conversation</button></div></article>').join("");
 }catch(error){
  message.hidden=false;message.textContent="Impossible de charger tes tickets : "+(error.message||"erreur inconnue");list.innerHTML="";
 }
}
async function loadAdminHelpRequests(){
 if(!isAdmin())return;
 const message=$("#adminHelpMessage"),list=$("#adminHelpList"),button=$("#refreshAdminHelp");
 message.hidden=false;message.textContent="Chargement des demandes…";button.disabled=true;
 try{
  const result=await sb.from("help_requests").select("*").order("created_at",{ascending:false}).limit(100);
  if(result.error)throw result.error;
  const requests=result.data||[],pending=requests.filter(x=>x.status==="pending").length;
  $("#adminHelpCount").textContent=requests.length+" demande"+(requests.length>1?"s":"")+" · "+pending+" en attente";
  message.hidden=requests.length>0;
  if(!requests.length)message.textContent="Aucune demande d’aide pour le moment.";
  list.innerHTML=requests.map(r=>'<article class="admin-submission-card" data-ticket-card="'+esc(r.id)+'" data-ticket-number="'+esc(r.ticket_number||"")+'" data-ticket-status="'+esc(r.status)+'">'+
   '<div class="admin-submission-top"><span class="tag">'+(r.status==="pending"?"En attente":"Traitée")+'</span><span class="admin-submission-date">'+date(r.created_at)+'</span></div>'+
   '<p class="admin-submission-meta"><strong>Ticket n° '+esc(r.ticket_number||"Non attribué")+'</strong></p>'+
   '<h4>'+esc(r.subject)+'</h4><p class="admin-submission-meta">'+esc(r.user_name)+' · '+esc(r.user_email||"E-mail non renseigné")+'</p>'+
   '<p class="admin-submission-body">'+esc(r.message)+'</p>'+
   '<div class="admin-submission-actions"><button type="button" class="btn btn-light" data-help-thread="'+esc(r.id)+'">Voir la conversation</button>'+
   (r.status==="pending"?'<button type="button" class="btn btn-dark" data-help-resolve="'+esc(r.id)+'">Marquer comme traitée</button>':"")+
   '</div></article>').join("");
  filterAdminHelpTickets();
 }catch(error){message.hidden=false;message.textContent="Impossible de charger les demandes : "+(error.message||"erreur inconnue");list.innerHTML="";}
 finally{button.disabled=false}
}
let hideClosedAdminTickets=false;
function filterAdminHelpTickets(){
 const input=$("#adminHelpTicketSearch"),list=$("#adminHelpList"),empty=$("#adminHelpSearchEmpty"),toggle=$("#toggleClosedAdminTickets");
 if(!input||!list||!empty)return;
 const query=input.value.trim().toLowerCase();
 let visible=0;
 list.querySelectorAll("[data-ticket-card]").forEach(card=>{
  const matches=(card.dataset.ticketNumber||"").toLowerCase().includes(query);
  const isClosed=card.dataset.ticketStatus!=="pending";
  const show=matches&&!(hideClosedAdminTickets&&isClosed);
  card.hidden=!show;
  if(show)visible++;
 });
 empty.hidden=!query||visible>0;
 if(toggle)toggle.textContent=hideClosedAdminTickets?"Afficher les tickets clôturés":"Masquer les tickets clôturés";
}
$("#adminHelpTicketSearch").addEventListener("input",filterAdminHelpTickets);
$("#toggleClosedAdminTickets").addEventListener("click",()=>{hideClosedAdminTickets=!hideClosedAdminTickets;filterAdminHelpTickets();});
async function handleHelpThreadAction(e,adminView){
 const button=e.target.closest("[data-help-thread]");if(!button)return;
 await openHelpThread(button.dataset.helpThread,button.closest(".admin-submission-card"),adminView,button);
}
async function handleHelpReply(e,adminView){
 const form=e.target.closest("[data-help-reply-form]");if(!form)return;
 e.preventDefault();
 if(!user){notice("Connecte-toi pour répondre.");return}
 const field=form.elements.message,message=field.value.trim(),ticketId=form.dataset.ticketId;
 if(!message){notice("Écris un message avant de l’envoyer.");return}
 const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent="Envoi…";
 try{
  const result=await sb.from("help_request_messages").insert({help_request_id:ticketId,sender_id:user.id,message});
  if(result.error)throw result.error;
  notice("Réponse envoyée.");const card=form.closest(".admin-submission-card"),threadButton=card.querySelector("[data-help-thread]");
  const old=card.querySelector(".help-thread");if(old)old.remove();
  await openHelpThread(ticketId,card,adminView,threadButton);
 }catch(error){notice("Impossible d’envoyer la réponse : "+(error.message||"réessaie."));button.disabled=false;button.textContent="Envoyer la réponse";}
}
$("#myHelpRequestsList").addEventListener("click",e=>handleHelpThreadAction(e,false));
$("#myHelpRequestsList").addEventListener("submit",e=>handleHelpReply(e,false));
$("#adminHelpList").addEventListener("click",e=>handleHelpThreadAction(e,true));
$("#adminHelpList").addEventListener("submit",e=>handleHelpReply(e,true));
$("#refreshAdminHelp").addEventListener("click",loadAdminHelpRequests);
$("#adminHelpList").addEventListener("click",async e=>{
 const button=e.target.closest("[data-help-resolve]");if(!button||!isAdmin())return;
 button.disabled=true;
 const result=await sb.from("help_requests").update({status:"resolved",resolved_at:new Date().toISOString()}).eq("id",button.dataset.helpResolve);
 if(result.error){notice("Impossible de mettre à jour la demande : "+result.error.message);button.disabled=false;return}
 notice("Demande marquée comme traitée.");await loadAdminHelpRequests();
});
$("#helpRequestForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!user){notice("Connecte-toi pour contacter l’administrateur.");$("#helpDialog").close();$("#loginDialog").showModal();return}
 const button=$("#sendHelpRequest"),message=$("#helpRequestMessage").value.trim();
 if(message.length<10){notice("Ton message doit contenir au moins 10 caractères.");return}
 button.disabled=true;button.textContent="Envoi…";
 try{
  const result=await sb.from("help_requests").insert({user_id:user.id,user_name:user.user_metadata?.display_name||"Membre",user_email:user.email||null,subject:$("#helpRequestSubject").value,message}).select("ticket_number").single();
  if(result.error)throw result.error;
  const ticket=result.data.ticket_number;
  $("#helpRequestForm").reset();$("#helpRequestStatus").textContent="Demande envoyée avec succès. Ton numéro de ticket est "+ticket+". Conserve-le pour le suivi.";
  notice("Demande envoyée · Ticket "+ticket);await loadMyHelpRequests();
 }catch(error){notice("Envoi impossible : "+(error.message||"réessaie plus tard."));}
 finally{button.disabled=false;button.textContent="Envoyer la demande";}
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
  notice("Si un compte existe pour cette adresse, un e-mail de réinitialisation va être envoyé.");
 }catch(error){notice("Impossible d’envoyer l’e-mail : "+(error?.message||"réessaie plus tard."));}
 finally{button.disabled=false;button.textContent="Mot de passe oublié ?"}
});
$("#passwordRecoveryForm").addEventListener("submit",async e=>{
 e.preventDefault();const password=$("#recoveryNewPassword").value;
 if(password.length<8){notice("Le mot de passe doit contenir au moins 8 caractères.");return}
 const button=$("#saveRecoveryPassword");button.disabled=true;button.textContent="Enregistrement…";
 try{
  const {error}=await sb.auth.updateUser({password});if(error)throw error;
  $("#passwordRecoveryDialog").close();$("#recoveryNewPassword").value="";recoveryLinkPending=false;await sb.auth.signOut();user=null;updateAdminMenu();const login=$("#loginDialog");if(!login.open)login.showModal();notice("Mot de passe modifié ! Tu peux maintenant te connecter avec ton nouveau mot de passe.");
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
  if(signup){if(r.data.session)await sb.auth.signOut({scope:"local"});$("#password").value="";$("#authMode").value="login";$("#authMode").dispatchEvent(new Event("change"));notice("Demande d’inscription envoyée. Confirme ton e-mail si demandé ; ton compte sera utilisable après approbation par l’administrateur.");return}
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
 e.preventDefault();if(!user){notice("Connecte-toi pour envoyer une contribution.");return}
 const body=$("#articleBody").value.trim();if(body.length<30){notice("Ajoute au moins 30 caractères.");return}
 const payload={title:$("#articleTitle").value.trim(),category:$("#articleCategory").value,excerpt:$("#articleExcerpt").value.trim()||body.slice(0,135),body};
 const wasEditing=Boolean(currentEditingId);
 const submission={...payload,article_id:currentEditingId||null,submission_type:wasEditing?"edit":"new",author_id:user.id,author_name:user.user_metadata?.display_name||"Savoir",status:"pending"};
 const result=await sb.from("article_submissions").insert(submission);
 if(result.error){notice("Envoi impossible : "+result.error.message);return}
 currentEditingId=null;$("#articleDialog").close();
 await loadNotifications();
 notice(wasEditing?"Modification envoyée à l’administration pour validation.":"Contribution envoyée à l’administration pour validation.");
});
$("#notificationToggle").addEventListener("click",async()=>{const panel=$("#notificationPanel"),opening=panel.hidden;panel.hidden=!opening;$("#notificationToggle").setAttribute("aria-expanded",String(opening));if(opening)await loadNotifications()});
$("#notificationList").addEventListener("click",e=>{const item=e.target.closest("[data-notification-id]");if(item)handleNotificationOpen(item)});
$("#notificationList").addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-notification-id]")){e.preventDefault();handleNotificationOpen(e.target)}});
$("#markNotificationsRead").addEventListener("click",markNotificationsRead);
document.addEventListener("click",e=>{if(!e.target.closest(".notification-wrap")){$("#notificationPanel").hidden=true;$("#notificationToggle").setAttribute("aria-expanded","false")}});
$("#resetSearch").addEventListener("click",()=>{query="";category="Tous";$("#searchInput").value="";$("#categorySelect").value="Tous";draw()});
$("#showMoreRecommendations").addEventListener("click",()=>{query="";$("#searchInput").value="";allArticlesView=true;window.history.pushState({view:"articles"},"","#articles");draw();window.scrollTo({top:0,behavior:"smooth"})});
document.addEventListener("click",e=>{if(e.target.closest("#backToRecommendations")){allArticlesView=false;query="";$("#searchInput").value="";category="Tous";$("#categorySelect").value="Tous";history.pushState({view:"home"},"",window.location.pathname+window.location.search);draw();window.scrollTo({top:0,behavior:"smooth"})}});

$("#resetRecommendations").addEventListener("click",()=>{try{localStorage.removeItem(READING_KEY)}catch{}renderRecommendations();notice("Tes recommandations ont été réinitialisées.")});
sb.auth.onAuthStateChange((event,s)=>{user=s?s.user:null;$("#accountEmail").textContent=user?(user.email||"Compte connecté"):"";updateAdminMenu();if(user&&(event==="SIGNED_IN"||event==="INITIAL_SESSION"))showWelcomeGreeting(user);if(!user)showWelcomeGreeting(null);subscribeNotifications();if(user)loadNotifications();else{siteNotifications=[];renderNotifications()}const gate=$("#loginDialog");if(event==="PASSWORD_RECOVERY"){recoveryLinkPending=false;if(gate.open)gate.close();if(!$("#passwordRecoveryDialog").open)$("#passwordRecoveryDialog").showModal();return}if(user){if(gate.open)gate.close();}else if(!recoveryLinkPending&&!gate.open)gate.showModal()});
$("#loginDialog").addEventListener("cancel",e=>e.preventDefault());
(async()=>{await syncUser()})();
