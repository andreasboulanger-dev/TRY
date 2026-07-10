// ╔═══════════════════════════════════════════════════════════╗
// ║  REVIEWS — Farm Reviews, Star Ratings                    ║
// ╚═══════════════════════════════════════════════════════════╝

// ── FARM REVIEWS ──
let currentReviewFarmId = null;
let pickedStars = 0;

function starsHTML(avg, size='big') {
  const full = Math.floor(avg), half = avg - full >= 0.4 ? 1 : 0;
  const cls = size==='big' ? 'star-icon' : 'star-sm';
  let h = '';
  for (let i=1;i<=5;i++) {
    if (i<=full) h += `<span class="${cls} filled">★</span>`;
    else if (i===full+1&&half) h += `<span class="${cls} half">★</span>`;
    else h += `<span class="${cls}">★</span>`;
  }
  return h;
}

async function loadFarmReviews(farmId) {
  try {
    return await supaFetch('farm_reviews', `farm_id=eq.${farmId}&order=created_at.desc&limit=20`);
  } catch(e) { return []; }
}

async function renderReviewSection(farmId, containerEl) {
  const reviews = await loadFarmReviews(farmId);
  const avg = reviews.length ? (reviews.reduce((s,r)=>s+(r.rating||0),0)/reviews.length) : 0;
  const canReview = !!currentUser;
  const alreadyReviewed = currentUser && reviews.some(r=>r.user_id===currentUser.id);

  let html = `
    <div class="review-section">
      <div class="detail-section-title">Reviews</div>
      <div class="review-summary">
        <div class="review-avg">${avg>0?avg.toFixed(1):'–'}</div>
        <div>
          <div class="review-stars-big">${avg>0?starsHTML(avg):''}</div>
          <div class="review-count">${reviews.length} review${reviews.length!==1?'s':''}</div>
        </div>
      </div>`;

  reviews.slice(0,5).forEach(r => {
    const initials=escHTML(getInitials(r.user_name));
    html+=`<div class="review-card">
      <div class="review-card-header">
        <div class="review-card-avatar">${initials}</div>
        <div class="review-card-meta">
          <div class="review-card-author">${escHTML(r.user_name||'Anonymous')}</div>
          <div class="review-stars-sm">${starsHTML(r.rating,'sm')}</div>
        </div>
        <div class="review-card-time">${formatTimeAgo(r.created_at)}</div>
      </div>
      ${r.comment?`<div class="review-card-text">${escHTML(r.comment)}</div>`:''}
      ${r.update_comment?`<div class="review-card-text" style="margin-top:8px;padding-top:8px;border-top:0.5px solid var(--border);color:var(--text-mid);font-style:italic;"><span style="font-size:11px;font-weight:600;color:var(--text-light);font-style:normal;">UPDATE · ${formatTimeAgo(r.updated_at)}</span><br>${escHTML(r.update_comment)}</div>`:''}
    </div>`;
  });

  if (alreadyReviewed) {
    const myReview = reviews.find(r=>r.user_id===currentUser.id);
    html += `<button class="review-write-btn" onclick="openReviewModal('${farmId}','update',JSON.parse(decodeURIComponent('${encodeURIComponent(JSON.stringify(myReview))}')))"><i class="ti ti-edit"></i> Update your review</button>`;
  } else if (canReview) {
    html += `<button class="review-write-btn" onclick="openReviewModal('${farmId}')"><i class="ti ti-star"></i> Write a review</button>`;
  } else {
    html += `<button class="review-write-btn" onclick="openAuthOrProfile()"><i class="ti ti-lock"></i> Sign in to write a review</button>`;
  }
  html += `</div>`;
  containerEl.insertAdjacentHTML('beforeend', html);
  return reviews;
}

let currentReviewMode = 'write'; // 'write' | 'update'
let currentReviewRecord = null;  // existing review object when in update mode

function openReviewModal(farmId, mode, existingReview) {
  currentReviewFarmId = farmId;
  currentReviewMode = mode || 'write';
  currentReviewRecord = existingReview || null;

  const f = allFarms.find(x => x.id === farmId);
  document.getElementById('reviewFarmName').textContent = f ? f.business_name : 'this farm';
  document.getElementById('reviewModal').classList.add('open');

  if (currentReviewMode === 'update') {
    // Show update fields, hide write fields
    document.getElementById('reviewModalTitle').textContent = 'Update your review';
    document.getElementById('reviewSubmitBtn').textContent = 'Submit update';
    document.getElementById('reviewWriteFields').style.display = 'none';
    document.getElementById('reviewUpdateFields').style.display = '';
    document.getElementById('reviewUpdateComment').value = '';
    // Show original review as preview
    const r = existingReview || {};
    const stars = '★'.repeat(r.rating||0) + '☆'.repeat(5-(r.rating||0));
    let preview = `<span style="color:var(--amber);letter-spacing:1px;">${stars}</span>`;
    if (r.comment) preview += `<br>${escHTML(r.comment)}`;
    if (r.update_comment) preview += `<br><span style="font-size:11px;font-weight:600;color:var(--text-light);">PREVIOUS UPDATE</span><br><em>${escHTML(r.update_comment)}</em>`;
    document.getElementById('reviewOriginalPreview').innerHTML = preview;
  } else {
    // Show write fields, hide update fields
    document.getElementById('reviewModalTitle').textContent = 'Write a review';
    document.getElementById('reviewSubmitBtn').textContent = 'Submit review';
    document.getElementById('reviewWriteFields').style.display = '';
    document.getElementById('reviewUpdateFields').style.display = 'none';
    pickedStars = 0;
    document.querySelectorAll('.star-pick').forEach(s=>s.classList.remove('selected'));
    document.getElementById('reviewComment').value = '';
  }
}

function closeReviewModal() { document.getElementById('reviewModal').classList.remove('open'); }
function handleReviewBackdrop(e) { if (e.target===document.getElementById('reviewModal')) closeReviewModal(); }

function pickStar(val) {
  pickedStars = val;
  document.querySelectorAll('.star-pick').forEach(s => {
    s.classList.toggle('selected', parseInt(s.dataset.val) <= val);
  });
}

async function submitReviewModal() {
  if (!currentUser) { closeReviewModal(); openAuthGate('farms'); return; }

  if (currentReviewMode === 'update') {
    const updateText = document.getElementById('reviewUpdateComment').value.trim();
    if (!updateText) { showToast('Please write your update first'); return; }
    try {
      const token = currentUser?.access_token || SUPA_KEY;
      const res = await fetch(`${SUPA_URL}/rest/v1/farm_reviews?id=eq.${currentReviewRecord.id}&user_id=eq.${currentUser.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ update_comment: updateText })
      });
      if (!res.ok) throw new Error(await res.text());
      closeReviewModal();
      showToast('Review updated! Thanks 🐝');
      const el = document.getElementById('farmDetailContent');
      const existingReviewSection = el.querySelector('.review-section');
      if (existingReviewSection) { existingReviewSection.remove(); renderReviewSection(currentReviewFarmId, el); }
    } catch(e) {
      showToast('Could not update — please try again');
    }
    return;
  }

  // Write mode
  if (!pickedStars) { showToast('Please select a star rating'); return; }
  const comment = document.getElementById('reviewComment').value.trim();
  try {
    await supaInsert('farm_reviews', {
      farm_id: currentReviewFarmId,
      user_id: currentUser.id,
      user_name: currentUser.name,
      rating: pickedStars,
      comment: comment || null
    });
    closeReviewModal();
    showToast('Review submitted! Thanks 🐝');
    const el = document.getElementById('farmDetailContent');
    const existingReviewSection = el.querySelector('.review-section');
    if (existingReviewSection) { existingReviewSection.remove(); renderReviewSection(currentReviewFarmId, el); }
  } catch(e) {
    showToast('Could not submit — please try again');
  }
}



