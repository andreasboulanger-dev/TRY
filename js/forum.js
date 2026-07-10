// ╔═══════════════════════════════════════════════════════════╗
// ║  FORUM — Posts, Replies, Likes, New Post                 ║
// ╚═══════════════════════════════════════════════════════════╝

// ── FORUM ──
let allPosts      = [];
let currentPostId = null;
let currentCat    = 'all';
let selectedPostCat = 'farms';

function switchForumTab(el) {
  document.querySelectorAll('.forum-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  currentCat = el.dataset.cat;
  renderForumPosts();
}

async function loadForumPosts() {
  const el = document.getElementById('forumContent');
  el.innerHTML = '<div class="map-loading"><div class="spinner"></div>Loading posts…</div>';
  try {
    allPosts = await supaFetchLimit('forum_posts', 'order=created_at.desc&limit=50');
  } catch(e) { allPosts = []; logError('loadForumPosts', e, 'Could not load posts'); }
  renderForumPosts();
}

function renderForumPosts() {
  const el = document.getElementById('forumContent');
  const filtered = currentCat === 'all' ? allPosts : allPosts.filter(p => p.category === currentCat);
  if (!filtered.length) {
    el.innerHTML = '<div class="no-posts">No posts yet — be the first! 🐝</div>';
    return;
  }
  const catColors = Object.fromEntries(FORUM_CATEGORIES.map(c => [c.key, c.cssClass]));
  const catLabels = Object.fromEntries(FORUM_CATEGORIES.map(c => [c.key, c.shortLabel]));
  const avatarColors = ['fa-amber','fa-green','fa-blue','fa-pink'];
  el.innerHTML = filtered.map(p => {
    const initials = escHTML(getInitials(p.author_name));
    const colorIdx = (p.author_name||'A').charCodeAt(0) % avatarColors.length;
    const timeAgo  = formatTimeAgo(p.created_at);
    const catClass = catColors[p.category] || 'fp-cat-general';
    const catLabel = catLabels[p.category] || 'Post';
    const safeId   = encodeURIComponent(p.id);
    return `<div class="forum-post" onclick="openPost(decodeURIComponent('${safeId}'))">
      <div class="forum-post-header">
        <div class="forum-avatar ${avatarColors[colorIdx]}">${initials}</div>
        <div class="fp-meta"><div class="fp-author">${escHTML(p.author_name||'Anonymous')}</div><div class="fp-time">${timeAgo}</div></div>
        <span class="fp-category ${catClass}">${escHTML(catLabel)}</span>
      </div>
      <div class="fp-title">${escHTML(p.title)}</div>
      <p class="fp-preview">${escHTML(p.content)}</p>
      <div class="fp-footer">
        <span class="fp-stat"><i class="ti ti-heart"></i> ${p.likes||0}</span>
        <span class="fp-stat" data-post-id="${safeId}"><i class="ti ti-message-circle"></i> Loading…</span>
      </div>
    </div>`;
  }).join('') + '<div class="scroll-pad"></div>';

  // Load all reply counts in a single request instead of one per post
  if (filtered.length) {
    const ids = filtered.map(p => p.id).join(',');
    supaFetch('forum_replies', `post_id=in.(${ids})&select=post_id`)
      .then(allReplies => {
        const countMap = {};
        allReplies.forEach(r => { countMap[r.post_id] = (countMap[r.post_id]||0) + 1; });
        el.querySelectorAll('.fp-stat[data-post-id]').forEach(stat => {
          const pid = decodeURIComponent(stat.dataset.postId);
          stat.innerHTML = `<i class="ti ti-message-circle"></i> ${countMap[pid]||0}`;
        });
      })
      .catch((e) => {
        logError('renderForumPosts:replyCounts', e);
        el.querySelectorAll('.fp-stat[data-post-id]').forEach(stat => {
          stat.innerHTML = `<i class="ti ti-message-circle"></i> –`;
        });
      });
  }
}

async function openPost(id) {
  currentPostId = id;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-post').classList.add('active');

  const el = document.getElementById('postDetailContent');
  el.innerHTML = '<div class="map-loading"><div class="spinner"></div>Loading…</div>';

  try {
    const post = allPosts.find(p => p.id === id) || (await supaFetch('forum_posts', `id=eq.${id}`))[0];
    const replies = await supaFetch('forum_replies', `post_id=eq.${id}&order=created_at.asc`);
    const catColors = Object.fromEntries(FORUM_CATEGORIES.map(c => [c.key, c.cssClass]));
    const catLabels = Object.fromEntries(FORUM_CATEGORIES.map(c => [c.key, c.label]));
    const avatarColors = ['fa-amber','fa-green','fa-blue','fa-pink'];
    const initials  = getInitials(post.author_name);
    const colorIdx  = (post.author_name||'A').charCodeAt(0) % avatarColors.length;
    const repliesHTML = replies.length ? replies.map(r => {
      const safeRId = encodeURIComponent(r.id);
      return `<div class="reply-card">
        <div class="reply-author">${escHTML(r.author_name||'Anonymous')} <span class="reply-time">${formatTimeAgo(r.created_at)}</span></div>
        <div class="reply-text">${escHTML(r.content)}</div>
        <button class="reply-like-btn" onclick="likeReply(decodeURIComponent('${safeRId}'), this)"><i class="ti ti-heart"></i> ${r.likes||0}</button>
      </div>`;
    }).join('') : '<div style="color:var(--text-light);font-size:13px;margin-bottom:16px;">No replies yet — be the first!</div>';

    const safePostId = encodeURIComponent(post.id);
    el.innerHTML = `
      <div class="post-header" style="margin-bottom:12px;">
        <div class="forum-avatar ${avatarColors[colorIdx]}" style="width:36px;height:36px;font-size:14px;">${escHTML(initials)}</div>
        <div class="post-meta">
          <div class="post-author">${escHTML(post.author_name||'Anonymous')}</div>
          <div class="post-time">${formatTimeAgo(post.created_at)}</div>
        </div>
        <span class="fp-category ${catColors[post.category]||'fp-cat-general'}">${escHTML(catLabels[post.category]||'Post')}</span>
      </div>
      <div class="post-full-title">${escHTML(post.title)}</div>
      <div class="post-full-body">${escHTML(post.content)}</div>
      <div class="post-full-actions">
        <button class="like-btn" id="postLikeBtn" onclick="likePost(decodeURIComponent('${safePostId}'), this)">
          <i class="ti ti-heart"></i> <span id="postLikeCount">${post.likes||0}</span> Likes
        </button>
      </div>
      <div class="replies-title">Replies (${replies.length})</div>
      ${repliesHTML}
      <div style="height:20px;"></div>`;
    restoreLikeState();
  } catch(e) {
    el.innerHTML = '<div class="no-posts">Could not load post.</div>';
  }
}

// ── Like helpers with localStorage dedup (client-side fast-path) + server dedup ──
function getLikedSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch(e) { return new Set(); }
}
function saveLikedSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch(e) {}
}

async function likePost(id, btn) {
  const liked = getLikedSet('hive_liked_posts');
  if (liked.has(id) || btn.classList.contains('liked')) {
    btn.classList.add('liked');
    return;
  }
  // Optimistic UI update
  liked.add(id);
  saveLikedSet('hive_liked_posts', liked);
  btn.classList.add('liked');
  const countEl = document.getElementById('postLikeCount');
  if (countEl) countEl.textContent = (parseInt(countEl.textContent)||0) + 1;
  try {
    const token = currentUser?.access_token || SUPA_KEY;
    const res = await fetch(`${SUPA_URL}/functions/v1/post-like`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: id, target_type: 'post' })
    });
    // If server says already liked, revert the optimistic count increment
    if (res.ok) {
      const d = await res.json();
      if (d.already_liked && countEl) countEl.textContent = Math.max(0, (parseInt(countEl.textContent)||0) - 1);
    }
  } catch(e) { logError('likePost', e); }
}

async function likeReply(id, btn) {
  const liked = getLikedSet('hive_liked_replies');
  if (liked.has(id) || btn.classList.contains('liked')) {
    btn.classList.add('liked');
    return;
  }
  // Optimistic UI update
  liked.add(id);
  saveLikedSet('hive_liked_replies', liked);
  btn.classList.add('liked');
  const current = parseInt((btn.textContent||'').replace(/\D/g,''))||0;
  btn.innerHTML = `<i class="ti ti-heart"></i> ${current + 1}`;
  try {
    const token = currentUser?.access_token || SUPA_KEY;
    const res = await fetch(`${SUPA_URL}/functions/v1/post-like`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: id, target_type: 'reply' })
    });
    // If server says already liked, revert the optimistic count increment
    if (res.ok) {
      const d = await res.json();
      if (d.already_liked) btn.innerHTML = `<i class="ti ti-heart"></i> ${current}`;
    }
  } catch(e) { logError('likeReply', e); }
}

// Restore liked state from localStorage when opening a post
function restoreLikeState() {
  const likedPosts = getLikedSet('hive_liked_posts');
  const likedReplies = getLikedSet('hive_liked_replies');
  document.querySelectorAll('[id^="postLikeBtn"]').forEach(btn => {
    const onclick = btn.getAttribute('onclick') || '';
    const m = onclick.match(/likePost\('([^']+)'/);
    if (m && likedPosts.has(m[1])) btn.classList.add('liked');
  });
  document.querySelectorAll('.reply-like-btn').forEach(btn => {
    const onclick = btn.getAttribute('onclick') || '';
    const m = onclick.match(/likeReply\(decodeURIComponent\('([^']+)'/);
    if (m && likedReplies.has(decodeURIComponent(m[1]))) btn.classList.add('liked');
  });
}

async function submitReply() {
  const input = document.getElementById('replyInput');
  const content = input.value.trim();
  if (!content || !currentPostId) return;
  input.value = '';
  try {
    await supaInsert('forum_replies', {
      post_id: currentPostId,
      content,
      author_name: currentUser?.name || 'Anonymous',
      user_id: currentUser?.id || null,
      likes: 0
    });
    openPost(currentPostId);
  } catch(e) {
    showToast('Could not send reply');
    input.value = content;
  }
}

function openNewPost() {
  document.getElementById('newPostModal').classList.add('open');
  // Pre-fill author name if the user is logged in
  const authorEl = document.getElementById('postAuthor');
  if (authorEl && currentUser?.name) authorEl.value = currentUser.name;
  setTimeout(() => document.getElementById('postTitle').focus(), 400);
}
function handleNewPostBackdrop(e) { if (e.target === document.getElementById('newPostModal')) document.getElementById('newPostModal').classList.remove('open'); }

function selectPostCat(el) {
  document.querySelectorAll('#newPostModal .type-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  selectedPostCat = el.dataset.cat;
}

async function submitNewPost() {
  const title   = document.getElementById('postTitle').value.trim();
  const content = document.getElementById('postContent').value.trim();
  const author  = document.getElementById('postAuthor').value.trim() || 'Anonymous';
  if (!title)   { showToast('Please enter a title'); return; }
  if (!content) { showToast('Please enter some content'); return; }
  try {
    await supaInsert('forum_posts', { title, content, author_name: author, user_id: currentUser?.id || null, category: selectedPostCat, likes: 0 });
    document.getElementById('newPostModal').classList.remove('open');
    document.getElementById('postTitle').value = '';
    document.getElementById('postContent').value = '';
    document.getElementById('postAuthor').value = '';
    await loadForumPosts();
    showToast('Post published! 🐝');
  } catch(e) {
    showToast('Error posting — please try again');
  }
}




