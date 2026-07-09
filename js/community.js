// ╔═══════════════════════════════════════════════════════════╗
// ║  COMMUNITY — Map, Activities, Modals                     ║
// ╚═══════════════════════════════════════════════════════════╝

// ── COMMUNITY MAP ──
let communityMap = null;
let communityViewMode = 'map'; // 'map' | 'forum'
let allActivities = [];
let activityMarkers = [];
let activityPickerMap = null, activityPickerMarker = null;
let activityPickerLat = null, activityPickerLng = null;
let selectedActivityCat = 'outdoor';

const ACT_COLORS = {
  outdoor:'#3B6D11', sport:'#D4851A', nightlife:'#6B3FA0',
  food:'#C0392B', social:'#185FA5', rideshare:'#2E7D32',
  entertainment:'#E65100', sightseeing:'#00695C', shopping:'#AD1457', wellness:'#5C5750',
  other:'#5C5750'
};
const ACT_ICONS = {
  outdoor:'🥾', sport:'⚽', nightlife:'🌙',
  food:'🍻', social:'👥', rideshare:'🚗',
  entertainment:'🎬', sightseeing:'📷', shopping:'🛍️', wellness:'🧘',
  other:'📌'
};

function initCommunityMap() {
  window.communityMap = communityMap = L.map('communityMap', {center:[-30,147], zoom:4, maxZoom:15, zoomControl:false});
  bindPinCardOutsideClose(communityMap);
  getUserLocation().then(pos => { if (pos) communityMap.setView([pos.lat, pos.lng], 11); });
  L.tileLayer(TILE_URL, {attribution:TILE_ATTR, maxZoom:19}).addTo(communityMap);
  liftMapAttribution(communityMap, 'forum');
  loadActivities();
}

async function loadActivities() {
  try {
    const rows = await supaFetch('activities', 'order=created_at.desc&limit=200');
    allActivities = rows.map(r => ({
      id: r.id,
      title: r.title,
      cat: r.category,
      desc: r.description || '',
      date: r.date || '',
      lat: parseFloat(r.latitude),
      lng: parseFloat(r.longitude),
      author: r.author_name,
      joined: r.joined_count || 0,
      joinedByMe: false
    }));
  } catch(e) {
    allActivities = [];
  }
  renderActivityMarkers(allActivities);
}

function createActivityIcon(cat) {
  const color = ACT_COLORS[cat] || ACT_COLORS.other;
  const emoji = ACT_ICONS[cat]  || ACT_ICONS.other;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26S36 31.5 36 18C36 8.06 27.94 0 18 0z" fill="${color}"/>
    <circle cx="18" cy="18" r="13" fill="white" opacity="0.2"/>
    <text x="18" y="23" text-anchor="middle" font-size="15">${emoji}</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [36,44],
    iconAnchor: [18,44],
    popupAnchor: [0,-46]
  });
}

function renderActivityMarkers(activities) {
  activityMarkers.forEach(m => communityMap.removeLayer(m));
  activityMarkers = [];
  activities.forEach(act => {
    const marker = L.marker([act.lat, act.lng], {icon: createActivityIcon(act.cat)}).addTo(communityMap);
    const color = ACT_COLORS[act.cat] || ACT_COLORS.other;
    const catLabel = act.cat.charAt(0).toUpperCase() + act.cat.slice(1);
    const popupHTML = `
      <div class="activity-popup-inner">
        <div class="activity-popup-title">${escHTML(act.title)}</div>
        <span class="activity-popup-cat" style="background:${color}22;color:${color}">${escHTML(catLabel)}</span>
        <div class="activity-popup-desc">${escHTML(act.desc)}</div>
        <div class="activity-popup-meta"><i class="material-symbols-outlined">calendar_today</i> ${escHTML(act.date)} &nbsp;·&nbsp; <i class="material-symbols-outlined">group</i> ${act.joined} joined</div>
        <button class="activity-join-btn${act.joinedByMe?' joined':''}" onclick="joinActivity('${act.id}',this)">
          ${act.joinedByMe ? '✓ Joined' : 'Join activity'}
        </button>
      </div>
    `;
    marker.on('click', () => openPinCard(popupHTML));
    activityMarkers.push(marker);
  });
}

function filterActivities(btn, cat) {
  document.querySelectorAll('#activityFilters .filter-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const filtered = cat === 'all' ? allActivities : allActivities.filter(a => a.cat === cat);
  renderActivityMarkers(filtered);
}

async function joinActivity(id, btn) {
  const act = allActivities.find(a => a.id === id);
  if (!act) return;
  if (!currentUser) { openAuthGate('forum'); return; }

  const joining = !act.joinedByMe;
  act.joinedByMe = joining;
  act.joined += joining ? 1 : -1;
  btn.textContent = joining ? '✓ Joined' : 'Join activity';
  btn.className = 'activity-join-btn' + (joining ? ' joined' : '');
  showToast(joining ? 'You joined the activity! 🎉' : 'Left the activity');

  try {
    const rpcName = joining ? 'join_activity' : 'leave_activity';
    await fetch(`${SUPA_URL}/rest/v1/rpc/${rpcName}`, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${currentUser.access_token || SUPA_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_activity_id: id })
    });
  } catch(e) {
    // Revert optimistic update on failure
    act.joinedByMe = !joining;
    act.joined += joining ? -1 : 1;
    btn.textContent = act.joinedByMe ? '✓ Joined' : 'Join activity';
    btn.className = 'activity-join-btn' + (act.joinedByMe ? ' joined' : '');
    showToast('Could not save — please try again');
  }
}

function toggleCommunityView() {
  const mapV = document.getElementById('communityMapView');
  const forumV = document.getElementById('communityForumView');
  const icon = document.getElementById('communityToggleIcon');
  const lbl  = document.getElementById('communityToggleLabel');
  if (communityViewMode === 'map') {
    communityViewMode = 'forum';
    mapV.style.display = 'none';
    forumV.style.display = 'flex';
    icon.className = 'material-symbols-outlined';
    icon.textContent = 'map';
    lbl.textContent = 'Map';
  } else {
    communityViewMode = 'map';
    forumV.style.display = 'none';
    mapV.style.display = 'flex';
    icon.className = 'material-symbols-outlined';
    icon.textContent = 'forum';
    lbl.textContent = 'Discussions';
    if (communityMap) setTimeout(() => communityMap.invalidateSize(), 50);
  }
}

function openCommunityAdd() {
  document.getElementById('communityAddModal').classList.add('open');
}

// ── NEW ACTIVITY MODAL ──
function openNewActivity() {
  // Set today as default date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('activityDate').value = today;
  document.getElementById('activityTitle').value = '';
  document.getElementById('activityDesc').value = '';
  selectedActivityCat = 'outdoor';
  document.querySelectorAll('[data-acat]').forEach(b => b.classList.toggle('selected', b.dataset.acat === 'outdoor'));
  document.getElementById('newActivityModal').classList.add('open');
  setTimeout(initActivityPickerMap, 300);
}

function selectActivityCat(btn) {
  document.querySelectorAll('[data-acat]').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedActivityCat = btn.dataset.acat;
}

function initActivityPickerMap() {
  if (activityPickerMap) { activityPickerMap.invalidateSize(); return; }
  const defaultLat = -33.87, defaultLng = 151.21;
  window.activityPickerMap = activityPickerMap = L.map('activityPickerMap', {zoomControl:false}).setView([defaultLat, defaultLng], 12);
  L.tileLayer(getTileUrl(), {attribution:TILE_ATTR,maxZoom:18}).addTo(activityPickerMap);
  activityPickerLat = defaultLat; activityPickerLng = defaultLng;
  activityPickerMarker = L.marker([defaultLat, defaultLng], {draggable:true}).addTo(activityPickerMap);
  activityPickerMarker.on('dragend', function() {
    const p = activityPickerMarker.getLatLng();
    activityPickerLat = p.lat; activityPickerLng = p.lng;
  });
  activityPickerMap.on('click', function(e) {
    activityPickerLat = e.latlng.lat; activityPickerLng = e.latlng.lng;
    activityPickerMarker.setLatLng(e.latlng);
  });
}

function locateOnActivityPicker() {
  if (!navigator.geolocation) { showToast('Geolocation not available'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    activityPickerLat = lat; activityPickerLng = lng;
    if (activityPickerMap) {
      activityPickerMap.setView([lat,lng],14);
      if (activityPickerMarker) activityPickerMarker.setLatLng([lat,lng]);
    }
  }, () => showToast('Could not get location'));
}

async function submitNewActivity() {
  const title = document.getElementById('activityTitle').value.trim();
  const desc  = document.getElementById('activityDesc').value.trim();
  const date  = document.getElementById('activityDate').value;
  if (!title) { showToast('Please add a title'); return; }
  if (!date)  { showToast('Please add a date'); return; }

  const payload = {
    title,
    category:    selectedActivityCat,
    description: desc || null,
    date,
    latitude:    activityPickerLat || -33.87,
    longitude:   activityPickerLng || 151.21,
    author_name: currentUser ? currentUser.name : 'Anonymous',
    user_id:     currentUser ? currentUser.id   : null,
    joined_count: 0
  };

  try {
    await supaInsert('activities', payload);
    showToast('Activity added to the map! 📍');
    document.getElementById('newActivityModal').classList.remove('open');
    await loadActivities();
    if (communityViewMode !== 'map') toggleCommunityView();
    if (communityMap && payload.latitude && payload.longitude) {
      communityMap.setView([payload.latitude, payload.longitude], 13);
    }
  } catch(e) {
    showToast('Could not save activity — please try again');
  }
}



