// ╔═══════════════════════════════════════════════════════════╗
// ║  JOBS — "Poolside" Multi-Platform Job Search              ║
// ╚═══════════════════════════════════════════════════════════╝
// Backed by the Adzuna API (see ADZUNA_APP_ID/APP_KEY in config.js), which
// aggregates listings from SEEK, Indeed, Jora and many other AU/NZ job
// boards — one search here fans out across all of them.

let jobsCountry     = 'au';   // 'au' | 'nz'
let jobsSort        = 'relevance'; // 'relevance' | 'date'
let jobsWhat        = '';
let jobsWhere       = '';
let jobsPageNum     = 1;
let jobsLoading     = false;
let jobsHasMore     = true;
let jobsResults     = [];
let jobsSearched    = false; // has at least one search run this session
const JOBS_PER_PAGE = 20;

// Common searches backpackers look for — tapping one fills the keyword
// field and runs the search immediately.
const JOBS_QUICK_SEARCHES = [
  'Farm work', 'Fruit picking', 'Hospitality', 'Au pair',
  'Warehouse', 'Construction', 'Bar work', 'Housekeeping',
];

// ── ENTRY POINT (called from the "Poolside" card on the Apps page) ──
function openJobsPage() {
  goToRaw('jobs');
  if (!jobsSearched) {
    buildJobsQuickChips();
    renderJobsEmptyState();
  }
}

function closeJobsPage() {
  goTo('apps');
}

function buildJobsQuickChips() {
  const el = document.getElementById('jobsQuickChips');
  if (!el || el.childElementCount) return;
  el.innerHTML = JOBS_QUICK_SEARCHES.map(term =>
    `<button class="filter-pill" onclick="quickJobSearch('${escHTML(term)}')">${escHTML(term)}</button>`
  ).join('');
}

function quickJobSearch(term) {
  document.getElementById('jobsWhatInput').value = term;
  searchJobs(true);
}

function selectJobsCountry(btn, country) {
  if (jobsCountry === country) return;
  document.querySelectorAll('#jobsCountryTabs .forum-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  jobsCountry = country;
  if (jobsSearched) searchJobs(true);
  else renderJobsEmptyState();
}

function setJobsSort(sort) {
  if (jobsSort === sort) return;
  jobsSort = sort;
  document.querySelectorAll('#jobsSortTabs .filter-pill').forEach(p => p.classList.toggle('active', p.dataset.jsort === sort));
  if (jobsSearched) searchJobs(true);
}

function onJobsSearchKey(e) {
  if (e.key === 'Enter') searchJobs(true);
}

function renderJobsEmptyState() {
  document.getElementById('jobsResults').innerHTML =
    `<div class="no-posts">🔎 Search backpacker-friendly jobs across ${jobsCountry === 'nz' ? 'New Zealand' : 'Australia'} — try a keyword above or tap a suggestion.</div>`;
}

// ── SEARCH ──
async function searchJobs(reset) {
  if (jobsLoading) return;
  if (reset) {
    jobsPageNum  = 1;
    jobsResults  = [];
    jobsHasMore  = true;
  }
  if (!jobsHasMore) return;

  jobsWhat  = document.getElementById('jobsWhatInput').value.trim();
  jobsWhere = document.getElementById('jobsWhereInput').value.trim();
  jobsSearched = true;

  if (!adzunaConfigured()) {
    document.getElementById('jobsResults').innerHTML = `
      <div class="no-posts">
        ⚠️ Job search isn't set up yet.<br>
        Add a free Adzuna API key (<code>ADZUNA_APP_ID</code> / <code>ADZUNA_APP_KEY</code>)
        in <code>config.js</code> — sign up at
        <a href="https://developer.adzuna.com/" target="_blank" rel="noopener">developer.adzuna.com</a>.
      </div>`;
    return;
  }

  jobsLoading = true;
  const resultsEl = document.getElementById('jobsResults');
  const loadMoreBtn = document.getElementById('jobsLoadMoreBtn');
  if (reset) {
    resultsEl.innerHTML = '<div class="map-loading"><div class="spinner"></div>Searching jobs…</div>';
  } else if (loadMoreBtn) {
    loadMoreBtn.disabled = true;
    loadMoreBtn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite;display:inline-block;"></i> Loading…';
  }

  try {
    const params = new URLSearchParams({
      app_id: ADZUNA_APP_ID,
      app_key: ADZUNA_APP_KEY,
      results_per_page: String(JOBS_PER_PAGE),
      'content-type': 'application/json',
      sort_by: jobsSort,
    });
    if (jobsWhat)  params.set('what', jobsWhat);
    if (jobsWhere) params.set('where', jobsWhere);

    const url = `https://api.adzuna.com/v1/api/jobs/${jobsCountry}/search/${jobsPageNum}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Adzuna API error ${res.status}`);
    const data = await res.json();
    const batch = Array.isArray(data.results) ? data.results : [];

    jobsResults = reset ? batch : jobsResults.concat(batch);
    jobsHasMore = batch.length >= JOBS_PER_PAGE;
    jobsPageNum += 1;

    renderJobResults(reset);
  } catch (e) {
    logError('searchJobs', e);
    if (reset) {
      resultsEl.innerHTML = '<div class="no-posts">Could not load jobs right now — please try again.</div>';
    } else {
      showToast('Could not load more jobs — please try again');
    }
  } finally {
    jobsLoading = false;
    if (loadMoreBtn) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.innerHTML = 'Load more jobs';
    }
  }
}

// ── RENDER ──
function jobSalaryLabel(job) {
  if (!job.salary_min && !job.salary_max) return '';
  const fmt = n => '$' + Math.round(n).toLocaleString();
  const approx = job.salary_is_predicted === '1' || job.salary_is_predicted === 1 ? '~' : '';
  if (job.salary_min && job.salary_max && job.salary_min !== job.salary_max) {
    return `${approx}${fmt(job.salary_min)} – ${fmt(job.salary_max)}`;
  }
  return `${approx}${fmt(job.salary_min || job.salary_max)}`;
}

function jobDescriptionSnippet(job) {
  const text = (job.description || '').replace(/\s+/g, ' ').trim();
  return text.length > 180 ? text.slice(0, 180).trim() + '…' : text;
}

function renderJobResults(reset) {
  const el = document.getElementById('jobsResults');

  if (!jobsResults.length) {
    el.innerHTML = `<div class="no-posts">No jobs found${jobsWhat ? ` for "${escHTML(jobsWhat)}"` : ''}${jobsWhere ? ` in ${escHTML(jobsWhere)}` : ''}. Try a different keyword or location.</div>`;
    return;
  }

  const cardsHTML = jobsResults.map(job => {
    const company  = job.company?.display_name || 'Unknown employer';
    const location = job.location?.display_name || '';
    const posted   = job.created ? formatTimeAgo(job.created) : '';
    const category = job.category?.label || '';
    const salary   = jobSalaryLabel(job);
    const snippet  = jobDescriptionSnippet(job);
    const safeUrl  = escHTML(job.redirect_url || '#');

    return `<div class="job-card">
      <div class="job-card-header">
        <div class="job-card-title">${escHTML(job.title || 'Untitled role')}</div>
        ${posted ? `<div class="job-card-time">${escHTML(posted)}</div>` : ''}
      </div>
      <div class="job-card-meta">
        <span class="job-card-company"><i class="ti ti-building-store"></i> ${escHTML(company)}</span>
        ${location ? `<span class="job-card-location"><i class="ti ti-map-pin"></i> ${escHTML(location)}</span>` : ''}
      </div>
      ${snippet ? `<p class="job-card-snippet">${escHTML(snippet)}</p>` : ''}
      <div class="job-card-footer">
        ${category ? `<span class="job-card-chip">${escHTML(category)}</span>` : ''}
        ${salary ? `<span class="job-card-chip job-card-chip-salary">${escHTML(salary)}</span>` : ''}
        <a class="job-card-apply" href="${safeUrl}" target="_blank" rel="noopener">Apply <i class="ti ti-external-link"></i></a>
      </div>
    </div>`;
  }).join('');

  const loadMoreHTML = jobsHasMore
    ? `<button class="job-load-more-btn" id="jobsLoadMoreBtn" onclick="searchJobs(false)">Load more jobs</button>`
    : `<div class="job-end-msg">You've reached the end of the results 🐝</div>`;

  el.innerHTML = `<div class="job-card-list">${cardsHTML}</div>${loadMoreHTML}<div style="height:20px;"></div>`;
}
