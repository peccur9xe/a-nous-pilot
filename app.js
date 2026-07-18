const STORAGE_KEY = 'a-nous-pilot-v1';

const defaultState = {
  organizer: 'David',
  groupName: 'Les proches',
  members: [
    { id: 'david', name: 'David', initials: 'D', channel: 'app', status: 'ready', detail: 'Calendrier connecté' },
    { id: 'clara', name: 'Clara', initials: 'C', channel: 'app', status: 'ready', detail: 'Calendrier connecté' },
    { id: 'marc', name: 'Marc', initials: 'M', channel: 'whatsapp', status: 'waiting', detail: 'Réponse par WhatsApp' },
    { id: 'sophie', name: 'Sophie', initials: 'S', channel: 'link', status: 'ready', detail: 'Préfère le centre' },
    { id: 'alex', name: 'Alex', initials: 'A', channel: 'sms', status: 'ready', detail: 'Végétarien · avant 23 h' }
  ],
  wish: 'Un bon resto jeudi soir, pas trop tard, tous les cinq.',
  stage: 'wish',
  selectedProposal: 0,
  invitationApproved: false,
  reservationApproved: false,
  finalized: false,
  outings: []
};

const proposals = [
  { name: 'Braise & Verveine', time: 'Jeudi 20 h', area: 'Aix centre', price: '€€', score: 96, facts: ['5/5 libres','18 min','Options végé'] },
  { name: 'Le Petit Comptoir', time: 'Jeudi 19 h 30', area: 'Mazarin', price: '€€', score: 91, facts: ['5/5 libres','23 min','Terrasse'] },
  { name: 'Maison Nacre', time: 'Vendredi 20 h', area: 'Rotonde', price: '€€€', score: 87, facts: ['5/5 libres','15 min','Options végé'] }
];

let state = loadState();
let currentTab = 'home';
const app = document.getElementById('app');

function loadState() {
  try { return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) }; }
  catch { return structuredClone(defaultState); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
}
function initials(name) { return name.trim().split(/\s+/).slice(0,2).map(part => part[0]?.toUpperCase() || '').join(''); }
function memberFaces(limit = 8) {
  const visible = state.members.slice(0, limit).map(member => `<span class="avatar" aria-label="${escapeHTML(member.name)}">${escapeHTML(member.initials)}</span>`).join('');
  const more = state.members.length > limit ? `<span class="avatar">+${state.members.length - limit}</span>` : '';
  return visible + more;
}
function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  render();
}

function render() {
  if (new URLSearchParams(location.search).has('respond')) return renderParticipantResponse();
  if (currentTab === 'groups') return renderGroup();
  if (currentTab === 'outings') return renderOutings();
  if (currentTab === 'privacy') return renderPrivacy();
  if (state.stage === 'coordination') return renderCoordination();
  if (state.stage === 'proposals') return renderProposals();
  if (state.stage === 'confirm') return renderConfirmation();
  renderHome();
}

function renderHome() {
  app.innerHTML = `
    <section>
      <div class="eyebrow">Concierge de groupe</div>
      <h1>Bonsoir ${escapeHTML(state.organizer)}</h1>
      <p class="lead">Qu’est-ce qui vous ferait plaisir&nbsp;?</p>
      <div class="assistant-bubble"><div class="assistant-label"><span>✦</span><span>Ton concierge</span></div>Dis-moi simplement ce que tu imagines. Je trouverai le meilleur moment et je coordonnerai tout le monde.</div>
      <div class="composer"><textarea id="wishInput" aria-label="Votre envie">${escapeHTML(state.wish)}</textarea><button class="round-button" id="startButton" type="button" aria-label="Organiser">↑</button></div>
      <div class="chips"><button class="chip example" data-wish="Un café tranquille ce week-end.">☕ Café</button><button class="chip example" data-wish="Une sortie avec les enfants dimanche.">🌿 Enfants</button><button class="chip example" data-wish="Un bon resto jeudi soir, pas trop tard.">🍽️ Dîner</button></div>
      <div class="section-head"><h2>${escapeHTML(state.groupName)}</h2><button class="ghost" id="editGroup">Modifier</button></div>
      <div class="faces">${memberFaces()}</div>
      <div class="privacy-note"><span>🔒</span><span>Les agendas restent privés. Seuls les créneaux libres sont utilisés.</span></div>
    </section>`;
  document.querySelectorAll('.example').forEach(button => button.addEventListener('click', () => { document.getElementById('wishInput').value = button.dataset.wish; }));
  document.getElementById('editGroup').addEventListener('click', () => setTab('groups'));
  document.getElementById('startButton').addEventListener('click', () => {
    const wish = document.getElementById('wishInput').value.trim();
    if (!wish) return;
    state.wish = wish;
    state.stage = 'coordination';
    state.finalized = false;
    saveState(); render();
  });
}

function renderCoordination() {
  const ready = state.members.filter(member => member.status === 'ready').length;
  app.innerHTML = `
    <section>
      <div class="eyebrow">Coordination</div><h1>Je m’occupe du groupe</h1><p class="lead">${escapeHTML(state.wish)}</p>
      <div class="stack">${state.members.map(member => `
        <div class="member-row"><span class="avatar">${escapeHTML(member.initials)}</span><div><strong>${escapeHTML(member.name)}</strong><small>${escapeHTML(member.detail)}</small></div>
        ${member.status === 'ready' ? '<span class="badge">Disponible</span>' : `<button class="secondary simulate" data-id="${member.id}">Simuler sa réponse</button>`}</div>`).join('')}</div>
      <div class="status-note"><span>✦</span><span>${ready === state.members.length ? 'Tout le monde a répondu. Les propositions sont prêtes.' : `${ready}/${state.members.length} réponses reçues.`}</span></div>
      <button class="primary" id="proposalButton" ${ready !== state.members.length ? 'disabled' : ''}>Voir les propositions</button>
      <button class="ghost" id="backWish">← Modifier l’envie</button>
    </section>`;
  document.querySelectorAll('.simulate').forEach(button => button.addEventListener('click', () => {
    const member = state.members.find(item => item.id === button.dataset.id);
    member.status = 'ready'; member.detail = 'Disponible jeudi après 19 h 45'; saveState(); render();
  }));
  document.getElementById('proposalButton').addEventListener('click', () => { state.stage = 'proposals'; saveState(); render(); });
  document.getElementById('backWish').addEventListener('click', () => { state.stage = 'wish'; saveState(); render(); });
}

function renderProposals() {
  app.innerHTML = `
    <section><div class="eyebrow">Assistant</div><h1>Trois sorties qui marchent</h1><p class="lead">Tout le monde est disponible. À toi de choisir.</p>
      <div class="stack">${proposals.map((proposal,index) => `
        <button class="card choice ${state.selectedProposal === index ? 'selected' : ''}" data-index="${index}" type="button">
          <span class="score">${proposal.score}%</span><h3>${escapeHTML(proposal.name)}</h3><p>${proposal.time} · ${proposal.area} · ${proposal.price}</p><span class="facts">${proposal.facts.map(fact => `<span>✓ ${fact}</span>`).join('')}</span>
        </button>`).join('')}</div>
      <div class="privacy-note"><span>✓</span><span>Ces lieux sont des données de démonstration. Dans le pilote connecté, prix et disponibilité seront vérifiés.</span></div>
      <button class="primary" id="chooseButton">Choisir cette sortie</button><button class="ghost" id="backCoord">← Retour aux réponses</button>
    </section>`;
  document.querySelectorAll('.choice').forEach(button => button.addEventListener('click', () => { state.selectedProposal = Number(button.dataset.index); saveState(); render(); }));
  document.getElementById('chooseButton').addEventListener('click', () => { state.stage = 'confirm'; saveState(); render(); });
  document.getElementById('backCoord').addEventListener('click', () => { state.stage = 'coordination'; saveState(); render(); });
}

function renderConfirmation() {
  const proposal = proposals[state.selectedProposal];
  app.innerHTML = `
    <section><div class="assistant-bubble"><div class="assistant-label"><span>🎉</span><span>Votre sortie est prête</span></div>Tu gardes le contrôle avant chaque action importante.</div>
      <div class="card">
        <div class="summary-row"><span>🍽️</span><div><strong>${escapeHTML(proposal.name)}</strong><small>${proposal.time} · ${proposal.area}</small></div></div>
        <div class="summary-row"><span>●●</span><div><strong>${escapeHTML(state.groupName)} · ${state.members.length} personnes</strong><small>Tout le monde a validé le créneau</small></div></div>
        <div class="summary-row"><span>💬</span><div><strong>App, lien, SMS et WhatsApp</strong><small>Récapitulatif adapté à chaque participant</small></div></div>
      </div>
      <label class="toggle"><input id="inviteApproval" type="checkbox" ${state.invitationApproved ? 'checked' : ''}><span>J’autorise l’envoi des invitations</span></label>
      <label class="toggle"><input id="reservationApproval" type="checkbox" ${state.reservationApproved ? 'checked' : ''}><span>J’autorise la préparation de la réservation</span></label>
      <button class="primary" id="finalizeButton">Finaliser la sortie</button>
      <div id="finalNotice">${state.finalized ? '<div class="notice">✓ Sortie organisée. Le récapitulatif est prêt à partager.</div>' : ''}</div>
      <button class="secondary" id="shareSummary">Partager le récapitulatif</button>
    </section>`;
  document.getElementById('inviteApproval').addEventListener('change', event => { state.invitationApproved = event.target.checked; saveState(); });
  document.getElementById('reservationApproval').addEventListener('change', event => { state.reservationApproved = event.target.checked; saveState(); });
  document.getElementById('finalizeButton').addEventListener('click', () => {
    const notice = document.getElementById('finalNotice');
    if (!state.invitationApproved) { notice.innerHTML = '<div class="notice danger">Confirme d’abord l’envoi des invitations.</div>'; return; }
    state.finalized = true;
    const record = { id: Date.now(), proposal, groupName: state.groupName, memberCount: state.members.length, reservationApproved: state.reservationApproved };
    if (!state.outings.some(item => item.proposal.name === proposal.name)) state.outings.unshift(record);
    saveState(); notice.innerHTML = '<div class="notice">✓ Sortie organisée. Le récapitulatif est prêt à partager.</div>';
  });
  document.getElementById('shareSummary').addEventListener('click', () => shareText(`🍽️ ${proposal.name}\n${proposal.time} · ${proposal.area}\n${state.groupName} (${state.members.length} personnes)\nOrganisé avec À nous.`));
}

function renderGroup() {
  app.innerHTML = `
    <section><div class="eyebrow">Groupe</div><h1>${escapeHTML(state.groupName)}</h1><p class="lead">De 3 à 20 personnes, avec ou sans l’app.</p>
      <div class="form-field"><label for="groupName">Nom du groupe</label><input id="groupName" value="${escapeHTML(state.groupName)}"></div>
      <div class="stack">${state.members.map(member => `<div class="member-row"><span class="avatar">${escapeHTML(member.initials)}</span><div><strong>${escapeHTML(member.name)}</strong><small>${escapeHTML(member.channel)}</small></div>${member.id === 'david' ? '<span class="badge">Vous</span>' : `<button class="ghost remove" data-id="${member.id}">Retirer</button>`}</div>`).join('')}</div>
      <div class="divider"></div><div class="form-field"><label for="newMember">Ajouter un ami</label><input id="newMember" placeholder="Prénom"></div>
      <div class="actions"><button class="secondary" id="addMember">Ajouter</button><button class="secondary" id="shareInvite">Partager un lien</button></div>
      <div id="groupNotice"></div>
    </section>`;
  document.getElementById('groupName').addEventListener('change', event => { state.groupName = event.target.value.trim() || state.groupName; saveState(); render(); });
  document.getElementById('addMember').addEventListener('click', () => {
    const input = document.getElementById('newMember'); const name = input.value.trim();
    if (!name || state.members.length >= 20) return;
    state.members.push({ id: `m-${Date.now()}`, name, initials: initials(name), channel: 'lien', status: 'waiting', detail: 'Invitation à envoyer' }); saveState(); render();
  });
  document.querySelectorAll('.remove').forEach(button => button.addEventListener('click', () => { state.members = state.members.filter(member => member.id !== button.dataset.id); saveState(); render(); }));
  document.getElementById('shareInvite').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?respond=1&group=${encodeURIComponent(state.groupName)}&wish=${encodeURIComponent(state.wish)}`;
    await shareText(`Rejoins ${state.groupName} pour organiser notre prochaine sortie : ${url}`);
    document.getElementById('groupNotice').innerHTML = '<div class="notice">Lien prêt à partager.</div>';
  });
}

function renderOutings() {
  app.innerHTML = `<section><div class="eyebrow">Sorties</div><h1>Les bons moments</h1><p class="lead">Les sorties confirmées apparaissent ici.</p>${state.outings.length ? `<div class="stack">${state.outings.map(item => `<div class="card"><h3>${escapeHTML(item.proposal.name)}</h3><p>${item.proposal.time} · ${item.proposal.area}</p><span class="badge">${item.memberCount} personnes</span></div>`).join('')}</div>` : '<div class="empty"><div class="big">◫</div>Aucune sortie finalisée pour le moment.</div>'}</section>`;
}

function renderPrivacy() {
  app.innerHTML = `<section><div class="eyebrow">Moi</div><h1>Contrôle et confidentialité</h1><p class="lead">Le prototype ne lit encore aucun vrai calendrier.</p>
    <div class="card"><div class="summary-row"><span>🔒</span><div><strong>Busy/free uniquement</strong><small>Jamais les titres, lieux ou participants</small></div></div><div class="summary-row"><span>✓</span><div><strong>Confirmation obligatoire</strong><small>Avant invitation et réservation</small></div></div><div class="summary-row"><span>◫</span><div><strong>Stockage local</strong><small>Les données de ce pilote restent dans ce navigateur</small></div></div></div>
    <div class="section-head"><h2>Installer sur iPhone</h2></div><div class="notice">Dans Safari : bouton Partager → « Sur l’écran d’accueil ».</div>
    <button class="secondary" id="resetApp">Réinitialiser la démonstration</button></section>`;
  document.getElementById('resetApp').addEventListener('click', () => { localStorage.removeItem(STORAGE_KEY); state = structuredClone(defaultState); currentTab = 'home'; render(); });
}

function renderParticipantResponse() {
  const params = new URLSearchParams(location.search);
  const group = params.get('group') || 'le groupe';
  const wish = params.get('wish') || 'une prochaine sortie';
  document.querySelector('.tabbar').hidden = true;
  app.innerHTML = `<section><div class="eyebrow">Invitation privée</div><h1>${escapeHTML(group)}</h1><p class="lead">${escapeHTML(wish)}</p>
    <div class="assistant-bubble"><div class="assistant-label">✦ À nous</div>Ta réponse ne dévoilera aucun détail de ton agenda.</div>
    <div class="form-field"><label for="participantName">Ton prénom</label><input id="participantName" autocomplete="given-name"></div>
    <fieldset class="card"><legend>Quand es-tu disponible ?</legend><label class="toggle"><input type="checkbox" name="slot" value="Jeudi 19 h 30">Jeudi 19 h 30</label><label class="toggle"><input type="checkbox" name="slot" value="Jeudi 20 h">Jeudi 20 h</label><label class="toggle"><input type="checkbox" name="slot" value="Vendredi 20 h">Vendredi 20 h</label></fieldset>
    <div class="form-field"><label for="constraints">Une contrainte ou préférence ?</label><textarea id="constraints" placeholder="Végétarien, enfants, avant 23 h…"></textarea></div>
    <button class="primary" id="sendResponse">Envoyer ma réponse</button><div id="responseNotice"></div></section>`;
  document.getElementById('sendResponse').addEventListener('click', async () => {
    const name = document.getElementById('participantName').value.trim();
    const slots = [...document.querySelectorAll('[name="slot"]:checked')].map(item => item.value);
    const constraints = document.getElementById('constraints').value.trim();
    if (!name || !slots.length) { document.getElementById('responseNotice').innerHTML = '<div class="notice danger">Indique ton prénom et au moins un créneau.</div>'; return; }
    await shareText(`Réponse À nous — ${name}\nDisponible : ${slots.join(', ')}\nPréférences : ${constraints || 'aucune'}`);
    document.getElementById('responseNotice').innerHTML = '<div class="notice">Merci ! Ta réponse est prête à être envoyée à l’organisateur.</div>';
  });
}

async function shareText(text) {
  try { if (navigator.share) await navigator.share({ text }); else await navigator.clipboard.writeText(text); }
  catch (error) { if (error.name !== 'AbortError') console.warn(error); }
}

document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => setTab(button.dataset.tab)));
document.getElementById('profileButton').addEventListener('click', () => setTab('privacy'));
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
render();
