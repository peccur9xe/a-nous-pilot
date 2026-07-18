const STORAGE_KEY = 'a-nous-pilot-v2';

const people = {
  david: member('david','David','app',true,true,true,true),
  clara: member('clara','Clara','app',true,true,true,true),
  marc: member('marc','Marc','whatsapp',true,true,false,true),
  sophie: member('sophie','Sophie','link',true,true,true,false),
  alex: member('alex','Alex','sms',true,true,true,true),
  julie: member('julie','Julie','email',true,false,false,false),
  philippe: member('philippe','Philippe','email',true,true,false,true),
  anne: member('anne','Anne','whatsapp',true,true,true,true),
  lucas: member('lucas','Lucas','app',true,true,true,true),
  emma: member('emma','Emma','whatsapp',false,false,false,false)
};

function member(id,name,channel,invited,profile,calendar,push) {
  return { id,name,initials:name.slice(0,1).toUpperCase(),channel,invited,profile,calendar,push,response:'pending',slots:[] };
}

const defaultState = {
  selectedGroupId:'friends',
  groups:[
    { id:'friends',name:'Les proches',type:'Amis',icon:'🥂',members:[people.david,people.clara,people.marc,people.sophie,people.alex] },
    { id:'family',name:'La famille',type:'Famille',icon:'🏡',members:[people.david,people.julie,people.philippe,people.anne] },
    { id:'colleagues',name:'Les collègues',type:'Collègues',icon:'☕',members:[people.david,people.lucas,people.emma] }
  ],
  activities:[
    {
      id:'dinner-17',groupId:'friends',title:'Resto & billard',request:'Un resto à la bonne franquette, plutôt quali, dans le 17e à Paris, où on peut jouer au billard, dans deux semaines.',
      criteria:['Restaurant','Dans deux semaines','Paris 17e','Bonne franquette','Plutôt quali','Billard'],place:'Club 17 · proposition',date:null,
      responses:{david:'yes',clara:'yes',marc:'pending',sophie:'yes',alex:'pending'},reminded:[],createdAt:Date.now()
    },
    {
      id:'family-lunch',groupId:'family',title:'Déjeuner de famille',request:'Un déjeuner familial un dimanche, accessible et calme.',
      criteria:['Déjeuner','Dimanche','Calme','Accessible'],place:'À trouver',date:null,
      responses:{david:'yes',julie:'pending',philippe:'yes',anne:'pending'},reminded:[],createdAt:Date.now()-86400000
    }
  ],
  profile:{name:'David',photo:null,interests:['Bonnes tables','Week-ends','Randonnée'],calendar:false,push:false,location:false},
  draftRequest:'Hey, organise-moi un resto dans deux semaines avec les proches : à la bonne franquette, plutôt quali, dans le 17e à Paris, où on peut jouer au billard.'
};

let state = loadState();
let currentTab = 'groups';
let detailGroupId = null;
let detailActivityId = null;
const app = document.getElementById('app');

function loadState() {
  try { return { ...structuredClone(defaultState), ...JSON.parse(localStorage.getItem(STORAGE_KEY)) }; }
  catch { return structuredClone(defaultState); }
}
function saveState() { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
function escapeHTML(value) { return String(value ?? '').replace(/[&<>'"]/g,char=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[char]); }
function initials(name) { return name.trim().split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()||'').join(''); }
function groupById(id) { return state.groups.find(group=>group.id===id); }
function activityById(id) { return state.activities.find(activity=>activity.id===id); }
function memberCompletion(person) { return [person.invited,person.profile,person.calendar,person.push].filter(Boolean).length; }
function groupCompletion(group) {
  const total = group.members.length*4;
  return total ? Math.round(group.members.reduce((sum,person)=>sum+memberCompletion(person),0)/total*100) : 0;
}
function incompleteMembers(group) { return group.members.filter(person=>memberCompletion(person)<4); }
function faces(group,limit=7) {
  const visible=group.members.slice(0,limit).map(person=>`<span class="avatar" aria-label="${escapeHTML(person.name)}">${escapeHTML(person.initials)}</span>`).join('');
  return visible+(group.members.length>limit?`<span class="avatar">+${group.members.length-limit}</span>`:'');
}
function setTab(tab) {
  currentTab=tab; detailGroupId=null; detailActivityId=null;
  document.querySelectorAll('[data-tab]').forEach(button=>button.classList.toggle('active',button.dataset.tab===tab));
  render();
}

function render() {
  if (new URLSearchParams(location.search).has('respond')) return renderParticipantResponse();
  document.querySelector('.tabbar').hidden=false;
  if (detailGroupId) return renderGroupDetail(detailGroupId);
  if (detailActivityId) return renderActivityDetail(detailActivityId);
  if (currentTab==='assistant') return renderAssistant();
  if (currentTab==='activities') return renderActivities();
  if (currentTab==='profile') return renderProfile();
  renderGroups();
}

function renderGroups() {
  const active=state.activities.filter(activity=>!activity.date).length;
  app.innerHTML=`<section>
    <div class="page-intro"><div class="eyebrow">Tableau de bord</div><h1>Mes groupes</h1><p class="lead">Chaque groupe a ses envies, ses habitudes et ses activités en cours.</p></div>
    <div class="hero-action"><div class="eyebrow">${active} organisations en cours</div><h2>Trouvons enfin une date</h2><p>Je collecte les réponses et relance les personnes manquantes jusqu’à obtenir un créneau exploitable.</p><button class="primary" id="newPlan">Proposer une activité</button></div>
    <div class="section-head"><h2>${state.groups.length} groupes</h2><button class="secondary" id="addGroup">+ Créer</button></div>
    <div class="group-grid">${state.groups.map(group=>groupCard(group)).join('')}</div>
    <div id="groupForm"></div>
  </section>`;
  document.getElementById('newPlan').addEventListener('click',()=>setTab('assistant'));
  document.getElementById('addGroup').addEventListener('click',renderCreateGroupForm);
  document.querySelectorAll('.group-open').forEach(button=>button.addEventListener('click',()=>{detailGroupId=button.dataset.id;render();}));
  document.querySelectorAll('[data-action="plan"]').forEach(button=>button.addEventListener('click',()=>{
    state.selectedGroupId=button.dataset.id; saveState(); setTab('assistant');
  }));
}

function groupCard(group) {
  const completion=groupCompletion(group); const missing=incompleteMembers(group);
  const activityCount=state.activities.filter(activity=>activity.groupId===group.id).length;
  return `<article class="group-card"><button class="group-open" data-id="${group.id}" type="button"><span class="group-top"><span class="group-icon">${group.icon}</span><span class="group-title"><h3>${escapeHTML(group.name)}</h3><p>${group.type} · ${group.members.length} membres · ${activityCount} activité${activityCount>1?'s':''}</p></span><span>›</span></span>
    <span class="faces">${faces(group,6)}</span><span class="completion"><span class="completion-head"><span>${completion===100?'Groupe complet':'Configuration du groupe'}</span><strong>${completion}%</strong></span><span class="progress-track"><span class="progress-fill" style="width:${completion}%"></span></span></span>
    <span class="missing">${missing.length?`${missing.map(person=>person.name).join(', ')} à compléter`:'Tout le monde est prêt ✓'}</span></button>
    <span class="inline-actions"><button class="chip" type="button" data-action="plan" data-id="${group.id}">✦ Organiser</button></span></article>`;
}

function renderCreateGroupForm() {
  document.getElementById('groupForm').innerHTML=`<div class="card" style="margin-top:14px"><h2>Nouveau groupe</h2>
    <div class="form-field"><label for="newGroupName">Nom</label><input id="newGroupName" placeholder="Amis du quartier"></div>
    <div class="form-field"><label for="newGroupType">Type</label><select id="newGroupType"><option>Amis</option><option>Famille</option><option>Collègues</option><option>Autre</option></select></div>
    <div class="actions"><button class="primary" id="createGroup">Créer manuellement</button><button class="secondary" id="whatsappGroup">Depuis WhatsApp</button></div><div id="createNotice"></div></div>`;
  document.getElementById('createGroup').addEventListener('click',()=>createGroup(false));
  document.getElementById('whatsappGroup').addEventListener('click',()=>createGroup(true));
}

function createGroup(fromWhatsApp) {
  const name=document.getElementById('newGroupName').value.trim(); const type=document.getElementById('newGroupType').value;
  if (!name) return;
  const group={id:`g-${Date.now()}`,name,type,icon:type==='Famille'?'🏡':type==='Collègues'?'☕':'🥂',members:[structuredClone(people.david)]};
  state.groups.push(group); saveState();
  if (fromWhatsApp) {
    document.getElementById('createNotice').innerHTML='<div class="notice whatsapp-note">Groupe créé. Partage maintenant son lien dans ton groupe WhatsApp pour que chaque membre le rejoigne avec son consentement.</div>';
    setTimeout(()=>{detailGroupId=group.id;render();},900);
  } else { detailGroupId=group.id; render(); }
}

function renderGroupDetail(id) {
  const group=groupById(id); if (!group) {detailGroupId=null;return render();}
  const missing=incompleteMembers(group); const completion=groupCompletion(group);
  app.innerHTML=`<section><div class="back-row"><button class="ghost" id="backGroups">← Groupes</button></div>
    <div class="eyebrow">${group.type}</div><h1>${escapeHTML(group.name)}</h1><p class="lead">${group.members.length} membres · ${completion}% complet</p>
    <div class="completion"><div class="completion-head"><span>Groupe prêt à organiser</span><strong>${completion}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${completion}%"></div></div></div>
    ${missing.length?`<div class="notice">${missing.length} membre${missing.length>1?'s':''} à compléter : ${missing.map(person=>person.name).join(', ')}.</div>`:'<div class="notice">✓ Tout le monde est prêt.</div>'}
    <div class="section-head"><h2>Membres</h2><button class="secondary" id="inviteMember">+ Inviter</button></div>
    <div class="stack">${group.members.map(person=>memberRow(person)).join('')}</div>
    ${missing.length?'<button class="primary" id="remindIncomplete">Relancer les membres incomplets</button>':''}
    <div class="section-head"><h2>Activités du groupe</h2></div><div class="activity-list">${state.activities.filter(activity=>activity.groupId===id).map(activity=>activityMiniCard(activity)).join('')||'<div class="empty">Aucune activité pour ce groupe.</div>'}</div>
    <div class="sticky-action"><button class="primary" id="planForGroup">✦ Organiser avec ce groupe</button></div><div id="groupDetailNotice"></div></section>`;
  document.getElementById('backGroups').addEventListener('click',()=>{detailGroupId=null;render();});
  document.getElementById('planForGroup').addEventListener('click',()=>{state.selectedGroupId=id;saveState();detailGroupId=null;setTab('assistant');});
  document.getElementById('inviteMember').addEventListener('click',()=>shareText(`Rejoins le groupe « ${group.name} » sur À nous : ${location.origin}${location.pathname}?respond=1&group=${encodeURIComponent(group.name)}`));
  document.getElementById('remindIncomplete')?.addEventListener('click',()=>{document.getElementById('groupDetailNotice').innerHTML='<div class="notice">Relances préparées par WhatsApp, SMS ou e-mail selon les préférences de chacun.</div>';});
  document.querySelectorAll('.open-activity').forEach(button=>button.addEventListener('click',()=>{detailActivityId=button.dataset.id;detailGroupId=null;render();}));
}

function memberRow(person) {
  const checks=[['Invitation',person.invited],['Profil',person.profile],['Calendrier',person.calendar],['Push',person.push]];
  return `<div class="member-row"><span class="avatar">${person.initials}</span><div><strong>${escapeHTML(person.name)}</strong><small>${checks.map(([label,ok])=>`${ok?'✓':'○'} ${label}`).join(' · ')}</small><span class="channel-row"><span class="channel">${person.channel}</span></span></div><span class="badge">${memberCompletion(person)}/4</span></div>`;
}

function activityMiniCard(activity) {
  const progress=activityProgress(activity);
  return `<button class="activity-card open-activity" data-id="${activity.id}" type="button"><span class="activity-head"><span><h3>${escapeHTML(activity.title)}</h3><p>${escapeHTML(groupById(activity.groupId)?.name)}</p></span><span class="badge">${progress.percent}%</span></span><span class="progress-track" style="display:block;margin-top:12px"><span class="progress-fill" style="display:block;width:${progress.percent}%"></span></span><span class="missing">${progress.label}</span></button>`;
}

function renderAssistant() {
  const group=groupById(state.selectedGroupId)||state.groups[0];
  app.innerHTML=`<section><div class="eyebrow">Nouvelle organisation</div><h1>Qu’est-ce qu’on organise&nbsp;?</h1><p class="lead">Écris ou dicte ta demande comme à un assistant personnel.</p>
    <div class="form-field"><label for="assistantGroup">Avec quel groupe ?</label><select id="assistantGroup">${state.groups.map(item=>`<option value="${item.id}" ${item.id===group.id?'selected':''}>${escapeHTML(item.name)}</option>`).join('')}</select></div>
    <div class="assistant-bubble"><div class="assistant-label">✦ Ton concierge</div>Donne-moi le maximum de contexte : période, ambiance, quartier, budget et contraintes particulières.</div>
    <div class="composer voice-row"><textarea id="requestInput" aria-label="Décrire l’activité">${escapeHTML(state.draftRequest)}</textarea><button class="voice-button" id="voiceButton" type="button" aria-label="Dicter">🎙</button></div>
    <div class="chips"><button class="chip example" data-text="Organise un verre convivial avec les collègues jeudi prochain, près du bureau.">☕ Verre collègues</button><button class="chip example" data-text="Trouve un déjeuner de famille calme et accessible un dimanche midi.">🏡 Déjeuner famille</button><button class="chip example" data-text="Organise un week-end entre potes au vert dans un mois.">🌿 Week-end potes</button></div>
    <button class="primary" id="understandButton">Comprendre ma demande</button><div id="understanding"></div>
  </section>`;
  document.getElementById('assistantGroup').addEventListener('change',event=>{state.selectedGroupId=event.target.value;saveState();});
  document.querySelectorAll('.example').forEach(button=>button.addEventListener('click',()=>{document.getElementById('requestInput').value=button.dataset.text;}));
  document.getElementById('understandButton').addEventListener('click',showUnderstanding);
  document.getElementById('voiceButton').addEventListener('click',startDictation);
}

function extractCriteria(text) {
  const lower=text.toLowerCase(); const result=[];
  if (/resto|restaurant/.test(lower)) result.push('Restaurant');
  if (/verre|apéro/.test(lower)) result.push('Verre');
  if (/week-end|weekend/.test(lower)) result.push('Week-end');
  if (/deux semaines/.test(lower)) result.push('Dans deux semaines');
  if (/dimanche/.test(lower)) result.push('Dimanche');
  if (/jeudi/.test(lower)) result.push('Jeudi');
  if (/17[eè]me|17e/.test(lower)) result.push('Paris 17e');
  if (/bonne franquette/.test(lower)) result.push('Bonne franquette');
  if (/quali/.test(lower)) result.push('Plutôt quali');
  if (/billard/.test(lower)) result.push('Billard');
  if (/calme/.test(lower)) result.push('Calme');
  if (/accessible/.test(lower)) result.push('Accessible');
  return result.length?result:['Activité à préciser','Date flexible'];
}

function showUnderstanding() {
  const text=document.getElementById('requestInput').value.trim(); if (!text) return;
  state.draftRequest=text; saveState(); const criteria=extractCriteria(text);
  document.getElementById('understanding').innerHTML=`<div class="card" style="margin-top:14px"><div class="eyebrow">J’ai compris</div><div class="criteria">${criteria.map(item=>`<span class="criterion">${escapeHTML(item)}</span>`).join('')}</div><p>Je vais d’abord obtenir une réponse et des disponibilités de chaque membre de <strong>${escapeHTML(groupById(state.selectedGroupId).name)}</strong>.</p><button class="primary" id="launchPlan">Lancer l’organisation</button></div>`;
  document.getElementById('launchPlan').addEventListener('click',()=>createActivity(text,criteria));
}

function createActivity(request,criteria) {
  const group=groupById(state.selectedGroupId); const responses={}; group.members.forEach(person=>responses[person.id]=person.id==='david'?'yes':'pending');
  const title=criteria.includes('Restaurant')?'Restaurant à organiser':criteria.includes('Week-end')?'Week-end à organiser':criteria.includes('Verre')?'Verre à organiser':'Nouvelle activité';
  const activity={id:`a-${Date.now()}`,groupId:group.id,title,request,criteria,place:'À trouver',date:null,responses,reminded:[],createdAt:Date.now()};
  state.activities.unshift(activity); saveState(); detailActivityId=activity.id; currentTab='activities'; document.querySelectorAll('[data-tab]').forEach(button=>button.classList.toggle('active',button.dataset.tab==='activities')); render();
}

function startDictation() {
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition; const button=document.getElementById('voiceButton');
  if (!Recognition) { document.getElementById('understanding').innerHTML='<div class="notice">La dictée vocale n’est pas disponible ici. Utilise le micro du clavier iPhone.</div>';return; }
  const recognition=new Recognition(); recognition.lang='fr-FR'; recognition.interimResults=false; button.classList.add('listening'); button.textContent='●';
  recognition.onresult=event=>{document.getElementById('requestInput').value=event.results[0][0].transcript;};
  recognition.onend=()=>{button.classList.remove('listening');button.textContent='🎙';}; recognition.onerror=()=>recognition.stop(); recognition.start();
}

function renderActivities() {
  app.innerHTML=`<section><div class="page-intro"><div class="eyebrow">Suivi</div><h1>Mes activités</h1><p class="lead">Je poursuis la coordination jusqu’à obtenir une réponse de chacun et une date exploitable.</p></div>
    <div class="activity-list">${state.activities.map(activity=>activityMiniCard(activity)).join('')||'<div class="empty">Aucune activité.</div>'}</div>
    <div class="sticky-action"><button class="primary" id="newActivity">+ Nouvelle activité</button></div></section>`;
  document.querySelectorAll('.open-activity').forEach(button=>button.addEventListener('click',()=>{detailActivityId=button.dataset.id;render();}));
  document.getElementById('newActivity').addEventListener('click',()=>setTab('assistant'));
}

function activityProgress(activity) {
  const responses=Object.values(activity.responses); const answered=responses.filter(value=>value!=='pending').length; const all=responses.length;
  const stages=[true,true,answered===all,Boolean(activity.date),activity.place!=='À trouver',answered===all&&Boolean(activity.date)];
  const done=stages.filter(Boolean).length; const percent=Math.round(done/stages.length*100);
  const label=answered<all?`${all-answered} réponse${all-answered>1?'s':''} manquante${all-answered>1?'s':''}`:activity.date?'Prêt à confirmer':'Recherche d’une date commune';
  return {percent,label,answered,all,stages};
}

function renderActivityDetail(id) {
  const activity=activityById(id); if (!activity) {detailActivityId=null;return render();}
  const group=groupById(activity.groupId); const progress=activityProgress(activity);
  const pending=group.members.filter(person=>activity.responses[person.id]==='pending');
  app.innerHTML=`<section><div class="back-row"><button class="ghost" id="backActivities">← Activités</button></div><div class="eyebrow">${escapeHTML(group.name)}</div><h1>${escapeHTML(activity.title)}</h1><p class="lead">${escapeHTML(activity.request)}</p>
    <div class="card"><div class="completion-head"><strong>${progress.label}</strong><strong>${progress.percent}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${progress.percent}%"></div></div>
      <div class="stage-list">${stageRow('Plan compris',true,'Demande analysée')}${stageRow('Activité définie',true,activity.criteria[0]||'À préciser')}${stageRow('Réponses collectées',progress.answered===progress.all,`${progress.answered}/${progress.all}`)}${stageRow('Date commune',Boolean(activity.date),activity.date||'En recherche')}${stageRow('Lieu trouvé',activity.place!=='À trouver',activity.place)}${stageRow('Confirmations finales',progress.answered===progress.all&&Boolean(activity.date),progress.answered===progress.all&&activity.date?'Prêtes':'En attente')}</div></div>
    <div class="response-summary"><div class="mini-stat"><strong>${progress.answered}</strong><small>réponses</small></div><div class="mini-stat"><strong>${pending.length}</strong><small>à relancer</small></div><div class="mini-stat"><strong>${activity.reminded.length}</strong><small>relances</small></div></div>
    <div class="section-head"><h2>Participants</h2>${pending.length?`<span class="badge">${pending.length} en attente</span>`:'<span class="badge">Complet</span>'}</div>
    <div class="stack">${group.members.map(person=>responseRow(person,activity)).join('')}</div>
    ${pending.length?'<button class="primary" id="remindPending">Relancer les personnes en attente</button>':'<div class="notice">✓ Tout le monde a répondu. Je peux maintenant finaliser la date commune.</div>'}
    <div class="section-head"><h2>Critères compris</h2></div><div class="criteria">${activity.criteria.map(item=>`<span class="criterion">${escapeHTML(item)}</span>`).join('')}</div>
    <div id="activityNotice"></div></section>`;
  document.getElementById('backActivities').addEventListener('click',()=>{detailActivityId=null;render();});
  document.querySelectorAll('.simulate-response').forEach(button=>button.addEventListener('click',()=>{
    const personId=button.dataset.person; activity.responses[personId]='yes';
    const member=group.members.find(item=>item.id===personId); member.slots=['Jeudi 20 h','Vendredi 20 h'];
    if (Object.values(activity.responses).every(value=>value!=='pending')) activity.date='Jeudi 20 h'; saveState(); render();
  }));
  document.getElementById('remindPending')?.addEventListener('click',()=>{
    pending.forEach(person=>{if(!activity.reminded.includes(person.id))activity.reminded.push(person.id);});saveState();
    document.getElementById('activityNotice').innerHTML=`<div class="notice">Relances préparées pour ${pending.map(person=>person.name).join(', ')} via ${pending.map(person=>person.channel).join(', ')}.</div>`;
  });
}

function stageRow(label,done,detail) { return `<div class="stage-row ${done?'done':'current'}"><span class="stage-dot">${done?'✓':'•'}</span><span>${label}</span><small>${escapeHTML(detail)}</small></div>`; }
function responseRow(person,activity) {
  const status=activity.responses[person.id]||'pending'; const label=status==='yes'?'A répondu oui':status==='no'?'Indisponible':'Sans réponse';
  return `<div class="member-row"><span class="avatar">${person.initials}</span><div><strong>${escapeHTML(person.name)}</strong><small>${label}${person.slots?.length?' · '+person.slots.join(', '):''}</small><span class="channel-row"><span class="channel">${person.channel}</span>${activity.reminded.includes(person.id)?'<span class="channel">Relancé</span>':''}</span></div>${status==='pending'?`<button class="secondary simulate-response" data-person="${person.id}">Simuler</button>`:'<span class="badge">✓</span>'}</div>`;
}

function renderProfile() {
  const profile=state.profile; const allInterests=['Bonnes tables','Week-ends','Randonnée','Culture','Sport','Avec les enfants','Concerts','Voyages','Bars tranquilles'];
  app.innerHTML=`<section><div class="eyebrow">Profil personnel</div><h1>Ce que j’aime</h1><p class="lead">Ces informations permettent à l’assistant de trouver des plans qui plaisent réellement au groupe.</p>
    <div class="profile-hero"><label class="profile-photo">${profile.photo?`<img src="${profile.photo}" alt="Photo de profil">`:escapeHTML(initials(profile.name))}<input class="photo-input" id="photoInput" type="file" accept="image/*" aria-label="Ajouter une photo"></label><div><h2>${escapeHTML(profile.name)}</h2><p>Organisateur · 3 groupes</p></div></div>
    <div class="section-head"><h2>Mes goûts</h2></div><div class="interest-grid">${allInterests.map(item=>`<button class="interest ${profile.interests.includes(item)?'active':''}" data-interest="${escapeHTML(item)}" type="button">${escapeHTML(item)}</button>`).join('')}</div>
    <div class="form-field" style="margin-top:16px"><label for="customInterest">Ajouter une préférence</label><div class="actions"><input id="customInterest" placeholder="Cuisine italienne, jazz…"><button class="secondary" id="addInterest">Ajouter</button></div></div>
    <div class="section-head"><h2>Autorisations</h2></div><div class="card">${permissionRow('◫','Calendrier','Créneaux occupés/libres uniquement','calendar',profile.calendar)}${permissionRow('◎','Notifications','Réponses, relances et confirmations','push',profile.push)}${permissionRow('⌖','Localisation','Trajets et suggestions à proximité','location',profile.location)}</div>
    <div class="privacy-note"><span>🔒</span><span>Chaque préférence peut rester privée pour l’assistant et ne pas être visible par le groupe.</span></div><div id="profileNotice"></div></section>`;
  document.querySelectorAll('.interest').forEach(button=>button.addEventListener('click',()=>{const item=button.dataset.interest;profile.interests=profile.interests.includes(item)?profile.interests.filter(value=>value!==item):[...profile.interests,item];saveState();render();}));
  document.getElementById('addInterest').addEventListener('click',()=>{const value=document.getElementById('customInterest').value.trim();if(value&&!profile.interests.includes(value)){profile.interests.push(value);saveState();render();}});
  document.querySelectorAll('.permission-toggle').forEach(button=>button.addEventListener('click',()=>{profile[button.dataset.permission]=!profile[button.dataset.permission];saveState();render();}));
  document.getElementById('photoInput').addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{profile.photo=reader.result;saveState();render();};reader.readAsDataURL(file);});
}

function permissionRow(icon,title,detail,key,enabled) { return `<div class="permission-row"><span>${icon}</span><div><strong>${title}</strong><small>${detail}</small></div><button class="secondary permission-toggle" data-permission="${key}" type="button"><span class="permission-status ${enabled?'ok':'wait'}">${enabled?'Activé':'Activer'}</span></button></div>`; }

function renderParticipantResponse() {
  const params=new URLSearchParams(location.search);const group=params.get('group')||'le groupe';const wish=params.get('wish')||'une prochaine activité';
  document.querySelector('.tabbar').hidden=true;
  app.innerHTML=`<section><div class="eyebrow">Invitation privée</div><h1>${escapeHTML(group)}</h1><p class="lead">${escapeHTML(wish)}</p><div class="assistant-bubble"><div class="assistant-label">✦ À nous</div>Réponds au minimum oui ou non. Aucun détail de ton agenda ne sera partagé.</div>
    <div class="form-field"><label for="participantName">Ton prénom</label><input id="participantName" autocomplete="given-name"></div>
    <fieldset class="card"><legend>Souhaites-tu participer ?</legend><label class="toggle"><input type="radio" name="participation" value="Oui">Oui</label><label class="toggle"><input type="radio" name="participation" value="Non">Non</label></fieldset>
    <fieldset class="card" style="margin-top:12px"><legend>Quels créneaux te conviennent ?</legend><label class="toggle"><input type="checkbox" name="slot" value="Jeudi 19 h 30">Jeudi 19 h 30</label><label class="toggle"><input type="checkbox" name="slot" value="Jeudi 20 h">Jeudi 20 h</label><label class="toggle"><input type="checkbox" name="slot" value="Vendredi 20 h">Vendredi 20 h</label></fieldset>
    <div class="form-field"><label for="constraints">Une contrainte ou préférence ?</label><textarea id="constraints" placeholder="Végétarien, enfants, avant 23 h…"></textarea></div><button class="primary" id="sendResponse">Envoyer ma réponse</button><div id="responseNotice"></div></section>`;
  document.getElementById('sendResponse').addEventListener('click',async()=>{const name=document.getElementById('participantName').value.trim();const participation=document.querySelector('[name="participation"]:checked')?.value;const slots=[...document.querySelectorAll('[name="slot"]:checked')].map(item=>item.value);const constraints=document.getElementById('constraints').value.trim();if(!name||!participation){document.getElementById('responseNotice').innerHTML='<div class="notice danger">Indique ton prénom et réponds oui ou non.</div>';return;}await shareText(`Réponse À nous — ${name}\nParticipation : ${participation}\nCréneaux : ${slots.join(', ')||'aucun'}\nPréférences : ${constraints||'aucune'}`);document.getElementById('responseNotice').innerHTML='<div class="notice">Merci ! Ta réponse est prête à être envoyée à l’organisateur.</div>';});
}

async function shareText(text) { try { if(navigator.share)await navigator.share({text});else await navigator.clipboard.writeText(text); } catch(error){if(error.name!=='AbortError')console.warn(error);} }

document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>setTab(button.dataset.tab)));
document.getElementById('profileButton').addEventListener('click',()=>setTab('profile'));
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
render();
