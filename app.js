
/* =========================================================
   STUDY FLOW — MAIN APPLICATION
   PART 1 / 2
   Requires:
   data.js, storage.js, revision.js, analytics.js
========================================================= */

(() => {
  "use strict";

  const DATA = window.StudyFlowData;
  const STORAGE = window.StudyFlowStorage;
  const REVISION = window.StudyFlowRevision;
  const ANALYTICS = window.StudyFlowAnalytics;

  if (!DATA || !STORAGE || !REVISION || !ANALYTICS) {
    console.error("STUDY FLOW: Required JS modules are missing.");
    document.body.innerHTML = `
      <div style="padding:30px;font-family:sans-serif">
        <h2>STUDY FLOW could not start</h2>
        <p>Check that data.js, storage.js, revision.js and analytics.js
        are loaded before app.js.</p>
      </div>`;
    return;
  }

  let state = STORAGE.load();

  if (!state || typeof state !== "object") {
    state = {
      subjects: [],
      chapters: [],
      sessions: [],
      revisionHistory: [],
      settings: {}
    };
  }

  let currentPage = "dashboard";
  let currentRevisionFilter = "due";
  let currentChapterFilter = "all";
  let searchQuery = "";
  let activeStudyChapter = null;

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const escapeHTML = (value = "") =>
    String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);

  const today = () => {
    if (DATA.getCurrentDate) return DATA.getCurrentDate();
    return new Date().toISOString().slice(0, 10);
  };

  const makeId = () =>
    "sf_" + Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);

  function saveState() {
    try {
      STORAGE.save(state);
      return true;
    } catch (error) {
      console.error("Save failed:", error);
      showToast("Data save nahi ho paya.", "error");
      return false;
    }
  }

  function showToast(message, type = "success") {
    let toast = $("#toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.className = "toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add("show");

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2600);
  }

  function formatDate(dateValue) {
    if (!dateValue) return "Not scheduled";

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "Not scheduled";

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function formatDuration(minutes = 0) {
    const value = Math.max(0, Number(minutes) || 0);
    const hours = Math.floor(value / 60);
    const mins = value % 60;

    if (hours && mins) return `${hours}h ${mins}m`;
    if (hours) return `${hours}h`;
    return `${mins}m`;
  }

  function getSubjectName(subjectId) {
    const subject = state.subjects.find(
      item => item.id === subjectId
    );

    return subject ? subject.name : "Other";
  }

  function getChapterName(chapterId) {
    const chapter = state.chapters.find(
      item => item.id === chapterId
    );

    return chapter ? chapter.title : "Unknown chapter";
  }

  function getStatusLabel(status) {
    const labels = {
      not_started: "Not Started",
      "not-started": "Not Started",
      in_progress: "In Progress",
      "in-progress": "In Progress",
      completed: "Completed"
    };

    return labels[status] || "Not Started";
  }

  function normalizeStatus(status) {
    if (status === "completed") return "completed";
    if (status === "in_progress" || status === "in-progress") {
      return "in_progress";
    }
    return "not_started";
  }

  function getChapterCounts() {
    const chapters = state.chapters || [];

    return {
      total: chapters.length,
      completed: chapters.filter(
        c => normalizeStatus(c.status) === "completed"
      ).length,
      inProgress: chapters.filter(
        c => normalizeStatus(c.status) === "in_progress"
      ).length,
      notStarted: chapters.filter(
        c => normalizeStatus(c.status) === "not_started"
      ).length
    };
  }

  function getCompletionPercentage() {
    const counts = getChapterCounts();
    if (!counts.total) return 0;

    return Math.round(
      (counts.completed / counts.total) * 100
    );
  }

  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
  }

  function setHTML(selector, value) {
    const element = $(selector);
    if (element) element.innerHTML = value;
  }

  /* ================= NAVIGATION ================= */

  function navigate(page) {
    if (!page) return;

    currentPage = page;

    $$("[data-page]").forEach(element => {
      const active = element.dataset.page === page;
      element.hidden = !active;
      element.classList.toggle("active", active);
    });

    $$("[data-view]").forEach(element => {
      const active = element.dataset.view === page;
      element.hidden = !active;
      element.classList.toggle("active", active);
    });

    $$("[data-nav]").forEach(button => {
      const active = button.dataset.nav === page;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });

    renderCurrentPage();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderCurrentPage() {
    switch (currentPage) {
      case "dashboard":
        renderDashboard();
        break;

      case "study":
      case "study-flow":
        renderStudyFlow();
        break;

      case "chapters":
      case "chapter-manager":
        renderChapters();
        break;

      case "revision":
      case "revisions":
        renderRevisions();
        break;

      case "analytics":
        renderAnalytics();
        break;

      case "settings":
        renderSettings();
        break;

      default:
        renderDashboard();
    }
  }

  /* ================= DASHBOARD ================= */

  function renderDashboard() {
    const counts = getChapterCounts();
    const percentage = getCompletionPercentage();

    const due = REVISION.getDueRevisions(state) || [];
    const upcoming = REVISION.getUpcomingRevisions(state) || [];

    const stats = ANALYTICS.getOverallStats(state) || {};

    setText("#totalChapters", counts.total);
    setText("#completedChapters", counts.completed);
    setText("#inProgressChapters", counts.inProgress);
    setText("#completionPercentage", `${percentage}%`);

    setText("#dueRevisionCount", due.length);
    setText("#upcomingRevisionCount", upcoming.length);

    setText(
      "#totalStudyTime",
      formatDuration(stats.totalStudyMinutes || 0)
    );

    setText(
      "#studyStreak",
      `${ANALYTICS.getStudyStreak(state) || 0} days`
    );

    const progressBar = $(
      "#overallProgressBar, [data-overall-progress]"
    );

    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
      progressBar.setAttribute("aria-valuenow", percentage);
    }

    renderDashboardFocus();
    renderDashboardRevisions();
    renderDashboardSubjects();
    renderDashboardRecentSessions();
  }

  function renderDashboardFocus() {
    const container = $(
      "#todayFocus, #todayFocusList, [data-today-focus]"
    );

    if (!container) return;

    const chapters = state.chapters.filter(
      chapter => normalizeStatus(chapter.status) !== "completed"
    );

    const selected = chapters.slice(0, 5);

    if (!selected.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Abhi koi pending chapter nahi hai.</p>
          <small>Naya chapter add karke shuru karo.</small>
        </div>`;
      return;
    }

    container.innerHTML = selected.map(chapter => `
      <div class="focus-item">
        <div class="focus-item-info">
          <strong>${escapeHTML(chapter.title)}</strong>
          <small>${escapeHTML(getSubjectName(chapter.subjectId))}</small>
        </div>
        <span class="status-badge ${normalizeStatus(chapter.status)}">
          ${getStatusLabel(chapter.status)}
        </span>
        <button data-action="study-chapter"
          data-id="${escapeHTML(chapter.id)}">
          Study
        </button>
      </div>
    `).join("");
  }

  function renderDashboardRevisions() {
    const container = $(
      "#dashboardRevisions, #dueRevisionPreview, [data-dashboard-revisions]"
    );

    if (!container) return;

    const due = REVISION.getDueRevisions(state) || [];

    if (!due.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No revisions due today.</p>
          <small>Your revision queue is clear.</small>
        </div>`;
      return;
    }

    container.innerHTML = due.slice(0, 5).map(item => {
      const chapter = state.chapters.find(
        c => c.id === (item.chapterId || item.id)
      );

      if (!chapter) return "";

      return `
        <div class="revision-preview-item">
          <div>
            <strong>${escapeHTML(chapter.title)}</strong>
            <small>${escapeHTML(getSubjectName(chapter.subjectId))}</small>
          </div>
          <button data-action="open-revision"
            data-id="${escapeHTML(chapter.id)}">
            Revise
          </button>
        </div>`;
    }).join("");
  }

  function renderDashboardSubjects() {
    const container = $(
      "#subjectProgress, #dashboardSubjects, [data-subject-progress]"
    );

    if (!container) return;

    if (!state.subjects.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No subjects added yet.</p>
        </div>`;
      return;
    }

    container.innerHTML = state.subjects.map(subject => {
      const chapters = state.chapters.filter(
        c => c.subjectId === subject.id
      );

      const completed = chapters.filter(
        c => normalizeStatus(c.status) === "completed"
      ).length;

      const percent = chapters.length
        ? Math.round(completed / chapters.length * 100)
        : 0;

      return `
        <div class="subject-progress-item">
          <div class="subject-progress-heading">
            <strong>${escapeHTML(subject.name)}</strong>
            <span>${completed}/${chapters.length}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${percent}%"></div>
          </div>
          <small>${percent}% completed</small>
        </div>`;
    }).join("");
  }

  function renderDashboardRecentSessions() {
    const container = $(
      "#recentSessions, #recentActivity, [data-recent-sessions]"
    );

    if (!container) return;

    const sessions = ANALYTICS.getRecentSessions(state, 5) || [];

    if (!sessions.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No study sessions recorded yet.</p>
        </div>`;
      return;
    }

    container.innerHTML = sessions.map(session => `
      <div class="session-item">
        <div>
          <strong>${escapeHTML(
            getChapterName(session.chapterId)
          )}</strong>
          <small>${escapeHTML(
            getSubjectName(session.subjectId)
          )}</small>
        </div>
        <span>${formatDuration(session.durationMinutes || 0)}</span>
      </div>
    `).join("");
  }

  /* ================= STUDY FLOW ================= */

  function renderStudyFlow() {
    const container = $(
      "#studySequence, #studyFlowList, [data-study-sequence]"
    );

    if (!container) return;

    const subjects = state.subjects || [];

    if (!subjects.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Pehle subject add karo.</p>
        </div>`;
      return;
    }

    container.innerHTML = subjects.map(subject => {
      const chapters = state.chapters.filter(
        c => c.subjectId === subject.id
      );

      return `
        <section class="study-subject-section">
          <div class="study-subject-heading">
            <h3>${escapeHTML(subject.name)}</h3>
            <span>${chapters.length} chapters</span>
          </div>

          <div class="study-chapter-sequence">
            ${chapters.length ? chapters.map((chapter, index) => `
              <div class="sequence-item">
                <span class="sequence-number">${index + 1}</span>
                <div class="sequence-info">
                  <strong>${escapeHTML(chapter.title)}</strong>
                  <small>${getStatusLabel(
                    normalizeStatus(chapter.status)
                  )}</small>
                </div>
                <button data-action="study-chapter"
                  data-id="${escapeHTML(chapter.id)}">
                  Open
                </button>
              </div>
            `).join("") : `
              <p class="muted">No chapters added.</p>
            `}
          </div>
        </section>`;
    }).join("");
  }

  /* ================= CHAPTER MANAGER ================= */

  function renderChapters() {
    const container = $(
      "#chapterList, #chaptersList, [data-chapter-list]"
    );

    if (!container) return;

    let chapters = [...state.chapters];

    if (currentChapterFilter !== "all") {
      chapters = chapters.filter(
        chapter => normalizeStatus(chapter.status) === currentChapterFilter
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();

      chapters = chapters.filter(chapter =>
        chapter.title.toLowerCase().includes(query) ||
        getSubjectName(chapter.subjectId).toLowerCase().includes(query)
      );
    }

    if (!chapters.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Koi chapter nahi mila.</p>
          <small>Search ya filter change karke dekho.</small>
        </div>`;
      return;
    }

    container.innerHTML = chapters.map(chapter => {
      const status = normalizeStatus(chapter.status);
      const confidence = Number(chapter.confidence ?? 0);

      return `
        <article class="chapter-card" data-chapter-id="${escapeHTML(chapter.id)}">
          <div class="chapter-card-main">
            <div class="chapter-card-heading">
              <h3>${escapeHTML(chapter.title)}</h3>
              <span class="status-badge ${status}">
                ${getStatusLabel(status)}
              </span>
            </div>

            <p class="chapter-subject">
              ${escapeHTML(getSubjectName(chapter.subjectId))}
            </p>

            <div class="chapter-meta">
              <span>Confidence: ${confidence}/10</span>
              <span>Revision: ${formatDate(chapter.nextRevisionAt)}</span>
            </div>
          </div>

          <div class="chapter-card-actions">
            <button data-action="study-chapter"
              data-id="${escapeHTML(chapter.id)}">Study</button>

            <button data-action="complete-chapter"
              data-id="${escapeHTML(chapter.id)}">Complete</button>

            <button data-action="edit-chapter"
              data-id="${escapeHTML(chapter.id)}">Edit</button>

            <button data-action="delete-chapter"
              data-id="${escapeHTML(chapter.id)}">Delete</button>
          </div>
        </article>`;
    }).join("");
  }

  function populateSubjectSelects() {
    const selects = $$(
      "#chapterSubject, #newChapterSubject, [data-subject-select]"
    );

    selects.forEach(select => {
      const previous = select.value;

      select.innerHTML = `
        <option value="">Select subject</option>
        ${state.subjects.map(subject => `
          <option value="${escapeHTML(subject.id)}">
            ${escapeHTML(subject.name)}
          </option>
        `).join("")}`;

      if (state.subjects.some(s => s.id === previous)) {
        select.value = previous;
      }
    });
  }

  function addChapter(title, subjectId) {
    const cleanTitle = String(title || "").trim();

    if (!cleanTitle || !subjectId) {
      showToast("Chapter name aur subject dono zaroori hain.", "error");
      return;
    }

    if (!state.subjects.some(s => s.id === subjectId)) {
      showToast("Selected subject nahi mila.", "error");
      return;
    }

    const chapter = DATA.createChapter
      ? DATA.createChapter(cleanTitle, subjectId)
      : {
          id: makeId(),
          title: cleanTitle,
          subjectId,
          status: "not_started",
          confidence: 0,
          createdAt: new Date().toISOString(),
          nextRevisionAt: null
        };

    state.chapters.push(chapter);
    saveState();
    refreshUI();
    showToast("Chapter added.");
  }

  function updateChapter(chapterId, updates) {
    const chapter = state.chapters.find(
      c => c.id === chapterId
    );

    if (!chapter) {
      showToast("Chapter nahi mila.", "error");
      return;
    }

    Object.assign(chapter, updates);
    saveState();
    refreshUI();
  }

  function completeChapter(chapterId) {
    const chapter = state.chapters.find(
      c => c.id === chapterId
    );

    if (!chapter) return;

    chapter.status = "completed";
    chapter.completedAt = new Date().toISOString();

    saveState();
    refreshUI();
    showToast("Chapter completed.");
  }

  function deleteChapter(chapterId) {
    const chapter = state.chapters.find(
      c => c.id === chapterId
    );

    if (!chapter) return;

    const confirmed = window.confirm(
      `"${chapter.title}" delete karna hai?`
    );

    if (!confirmed) return;

    state.chapters = state.chapters.filter(
      c => c.id !== chapterId
    );

    state.sessions = (state.sessions || []).filter(
      s => s.chapterId !== chapterId
    );

    state.revisionHistory = (state.revisionHistory || []).filter(
      r => r.chapterId !== chapterId
    );

    saveState();
    refreshUI();
    showToast("Chapter deleted.");
  }

  function editChapter(chapterId) {
    const chapter = state.chapters.find(
      c => c.id === chapterId
    );

    if (!chapter) return;

    const title = window.prompt(
      "Chapter name:",
      chapter.title
    );

    if (title === null) return;

    const cleanTitle = title.trim();

    if (!cleanTitle) {
      showToast("Chapter name empty nahi ho sakta.", "error");
      return;
    }

    chapter.title = cleanTitle;
    saveState();
    refreshUI();
    showToast("Chapter updated.");
}

  /* ================= STUDY SESSION ================= */

  function startStudy(chapterId) {
    const chapter = state.chapters.find(
      c => c.id === chapterId
    );

    if (!chapter) {
      showToast("Chapter nahi mila.", "error");
      return;
    }

    activeStudyChapter = chapterId;

    const durationInput = window.prompt(
      "Study duration kitne minutes? (Example: 45)",
      "45"
    );

    if (durationInput === null) return;

    const duration = Number(durationInput);

    if (!Number.isFinite(duration) || duration <= 0) {
      showToast("Valid duration enter karo.", "error");
      return;
    }

    const methods = [
      "Active Recall",
      "Feynman Technique",
      "Reading",
      "Question Practice",
      "Mixed Practice"
    ];

    const methodInput = window.prompt(
      "Study method choose karo:\n" +
      methods.map((m, i) => `${i + 1}. ${m}`).join("\n"),
      "1"
    );

    if (methodInput === null) return;

    const methodIndex = Number(methodInput) - 1;
    const method = methods[methodIndex] || methods[0];

    const session = {
      id: makeId(),
      chapterId: chapter.id,
      subjectId: chapter.subjectId,
      date: today(),
      startedAt: new Date().toISOString(),
      durationMinutes: duration,
      method,
      type: "study"
    };

    state.sessions = state.sessions || [];
    state.sessions.push(session);

    if (normalizeStatus(chapter.status) !== "completed") {
      chapter.status = "in_progress";
    }

    chapter.lastStudiedAt = new Date().toISOString();

    saveState();
    refreshUI();

    showToast(`${formatDuration(duration)} study session saved.`);
  }

  /* ================= REVISION SYSTEM ================= */

  function renderRevisions() {
    const container = $(
      "#revisionList, #revisionsList, [data-revision-list]"
    );

    if (!container) return;

    const due = REVISION.getDueRevisions(state) || [];
    const upcoming = REVISION.getUpcomingRevisions(state) || [];

    let items = currentRevisionFilter === "upcoming"
      ? upcoming
      : currentRevisionFilter === "all"
        ? [...due, ...upcoming]
        : due;

    if (!items.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No revisions in this section.</p>
          <small>Chapter complete karke confidence rate karo.</small>
        </div>`;
      return;
    }

    container.innerHTML = items.map(item => {
      const chapterId = item.chapterId || item.id;

      const chapter = state.chapters.find(
        c => c.id === chapterId
      );

      if (!chapter) return "";

      return `
        <article class="revision-card">
          <div>
            <h3>${escapeHTML(chapter.title)}</h3>
            <small>${escapeHTML(getSubjectName(chapter.subjectId))}</small>
            <p>Current confidence: ${Number(chapter.confidence || 0)}/10</p>
            <p>Next revision: ${formatDate(chapter.nextRevisionAt)}</p>
          </div>

          <button data-action="revise-chapter"
            data-id="${escapeHTML(chapter.id)}">
            Complete Revision
          </button>
        </article>`;
    }).join("");
  }

  function openRevision(chapterId) {
    const chapter = state.chapters.find(
      c => c.id === chapterId
    );

    if (!chapter) return;

    const rating = window.prompt(
      "Revision ke baad apna confidence 0 se 10 rate karo.",
      String(chapter.confidence ?? 5)
    );

    if (rating === null) return;

    const confidence = Number(rating);

    if (
      !Number.isInteger(confidence) ||
      confidence < 0 ||
      confidence > 10
    ) {
      showToast("Confidence 0 se 10 ke beech hona chahiye.", "error");
      return;
    }

    if (typeof REVISION.completeRevision === "function") {
      REVISION.completeRevision(state, chapterId, confidence);
    } else {
      chapter.confidence = confidence;
      chapter.lastRevisedAt = new Date().toISOString();

      const intervals = [
        1, 1, 1, 2, 4, 6, 9, 13, 18, 22, 25
      ];

      const days = intervals[confidence];

      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + days);

      chapter.nextRevisionAt = nextDate.toISOString();
    }

    saveState();
    refreshUI();

    showToast("Revision saved. Confidence updated.");
  }

  /* ================= ANALYTICS ================= */

  function renderAnalytics() {
    const stats = ANALYTICS.getOverallStats(state) || {};
    const counts = getChapterCounts();

    setText("#analyticsTotalChapters", counts.total);
    setText("#analyticsCompleted", counts.completed);

    setText(
      "#analyticsCompletion",
      `${getCompletionPercentage()}%`
    );

    setText(
      "#analyticsStudyTime",
      formatDuration(stats.totalStudyMinutes || 0)
    );

    setText(
      "#analyticsSessions",
      stats.totalSessions || (state.sessions || []).length
    );

    setText(
      "#analyticsStreak",
      `${ANALYTICS.getStudyStreak(state) || 0} days`
    );

    renderSubjectAnalytics();
    renderDailyAnalytics();
    renderMethodAnalytics();
  }

  function renderSubjectAnalytics() {
    const container = $(
      "#subjectAnalytics, #analyticsSubjects, [data-subject-analytics]"
    );

    if (!container) return;

    container.innerHTML = state.subjects.map(subject => {
      const chapters = state.chapters.filter(
        c => c.subjectId === subject.id
      );

      const completed = chapters.filter(
        c => normalizeStatus(c.status) === "completed"
      ).length;

      const percentage = chapters.length
        ? Math.round(completed / chapters.length * 100)
        : 0;

      return `
        <div class="analytics-subject">
          <div>
            <strong>${escapeHTML(subject.name)}</strong>
            <span>${percentage}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill"
              style="width:${percentage}%"></div>
          </div>
          <small>${completed} of ${chapters.length} chapters</small>
        </div>`;
    }).join("");
  }

  function renderDailyAnalytics() {
    const container = $(
      "#dailyAnalytics, #dailyActivity, [data-daily-analytics]"
    );

    if (!container) return;

    const daily = ANALYTICS.getDailyActivity(state, 7) || [];

    if (!daily.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Study activity will appear here.</p>
        </div>`;
      return;
    }

    const maxMinutes = Math.max(
      1,
      ...daily.map(item => Number(item.minutes || 0))
    );

    container.innerHTML = daily.map(item => {
      const minutes = Number(item.minutes || 0);
      const height = Math.max(
        minutes > 0 ? 5 : 0,
        Math.round(minutes / maxMinutes * 100)
      );

      return `
        <div class="daily-bar-item">
          <div class="daily-bar-track">
            <div class="daily-bar"
              style="height:${height}%"></div>
          </div>
          <strong>${minutes}</strong>
          <small>${escapeHTML(item.date || "")}</small>
        </div>`;
    }).join("");
  }

  function renderMethodAnalytics() {
    const container = $(
      "#methodAnalytics, #studyMethods, [data-method-analytics]"
    );

    if (!container) return;

    const methods = ANALYTICS.getMethodStats(state) || [];

    if (!methods.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No method data available yet.</p>
        </div>`;
      return;
    }

    container.innerHTML = methods.map(item => `
      <div class="method-stat">
        <strong>${escapeHTML(item.method)}</strong>
        <span>${item.count} sessions</span>
        <small>${formatDuration(item.minutes || 0)}</small>
      </div>
    `).join("");
  }

  /* ================= SETTINGS ================= */

  function renderSettings() {
    const subjectContainer = $(
      "#settingsSubjects, #subjectSettings, [data-settings-subjects]"
    );

    if (subjectContainer) {
      subjectContainer.innerHTML = state.subjects.map(subject => `
        <div class="settings-subject-item">
          <span>${escapeHTML(subject.name)}</span>
          <button data-action="delete-subject"
            data-id="${escapeHTML(subject.id)}">
            Delete
          </button>
        </div>
      `).join("");
    }
  }

  function addSubject(name) {
    const cleanName = String(name || "").trim();

    if (!cleanName) {
      showToast("Subject name enter karo.", "error");
      return;
    }

    const exists = state.subjects.some(
      subject => subject.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (exists) {
      showToast("Ye subject pehle se hai.", "error");
      return;
    }

    const subject = DATA.createSubject
      ? DATA.createSubject(cleanName)
      : {
          id: makeId(),
          name: cleanName,
          createdAt: new Date().toISOString()
        };

    state.subjects.push(subject);

    saveState();
    refreshUI();
    showToast("Subject added.");
  }

  function deleteSubject(subjectId) {
    const subject = state.subjects.find(
      s => s.id === subjectId
    );

    if (!subject) return;

    const hasChapters = state.chapters.some(
      c => c.subjectId === subjectId
    );

    if (hasChapters) {
      showToast(
        "Pehle is subject ke chapters delete ya move karo.",
        "error"
      );
      return;
    }

    if (!window.confirm(`Delete ${subject.name}?`)) return;

    state.subjects = state.subjects.filter(
      s => s.id !== subjectId
    );

    saveState();
    refreshUI();
    showToast("Subject deleted.");
  }

  /* ================= BACKUP / RESTORE ================= */

  function exportBackup() {
    const backup = {
      app: "STUDY FLOW",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: state
    };

    const blob = new Blob(
      [JSON.stringify(backup, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `study-flow-backup-${today()}.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showToast("Backup exported.");
  }

  function restoreBackup(file) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = event => {
      try {
        const parsed = JSON.parse(event.target.result);
        const restored = parsed.data || parsed;

        if (
          !restored ||
          !Array.isArray(restored.subjects) ||
          !Array.isArray(restored.chapters)
        ) {
          throw new Error("Invalid backup structure");
        }

        if (!window.confirm(
          "Current data replace ho jayega. Continue?"
        )) return;

        state = {
          subjects: restored.subjects,
          chapters: restored.chapters,
          sessions: Array.isArray(restored.sessions)
            ? restored.sessions : [],
          revisionHistory: Array.isArray(restored.revisionHistory)
            ? restored.revisionHistory : [],
          settings: restored.settings || {}
        };

        saveState();
        refreshUI();

        showToast("Backup restored successfully.");
      } catch (error) {
        console.error(error);
        showToast("Backup file invalid hai.", "error");
      }
    };

    reader.onerror = () => {
      showToast("File read nahi ho payi.", "error");
    };

    reader.readAsText(file);
  }

  function resetAllData() {
    const confirmed = window.confirm(
      "Kya tum sach mein STUDY FLOW ka sara data reset karna chahte ho?"
    );

    if (!confirmed) return;

    const secondConfirmation = window.confirm(
      "Ye action tumhara current study data clear kar dega. Continue?"
    );

    if (!secondConfirmation) return;

    if (typeof STORAGE.clearAll === "function") {
      STORAGE.clearAll();
      state = STORAGE.load();
    } else if (typeof STORAGE.reset === "function") {
      state = STORAGE.reset();
    } else {
      state = {
        subjects: [],
        chapters: [],
        sessions: [],
        revisionHistory: [],
        settings: {}
      };
      saveState();
    }

    refreshUI();
    showToast("Study data reset.");
  }

  /* ================= SEARCH & FILTERS ================= */

  function handleSearch(value) {
    searchQuery = String(value || "").trim();
    renderChapters();
  }

  function handleChapterFilter(value) {
    currentChapterFilter = value || "all";
    renderChapters();
  }

  function handleRevisionFilter(value) {
    currentRevisionFilter = value || "due";
    renderRevisions();
  }

  /* ================= FORM HANDLERS ================= */

  function handleAddChapterForm(form) {
    const title = $(
      '[name="chapterName"], #chapterName, #newChapterName',
      form
    );

    const subject = $(
      '[name="subjectId"], #chapterSubject, #newChapterSubject',
      form
    );

    if (!title || !subject) {
      showToast("Chapter form fields nahi mile.", "error");
      return;
    }

    addChapter(title.value, subject.value);
    form.reset();
  }

  function handleAddSubjectForm(form) {
    const input = $(
      '[name="subjectName"], #subjectName, #newSubjectName',
      form
    );

    if (!input) {
      showToast("Subject input nahi mila.", "error");
      return;
    }

    addSubject(input.value);
    form.reset();
  }

  /* ================= GLOBAL EVENT LISTENERS ================= */

  function bindNavigation() {
    document.addEventListener("click", event => {
      const nav = event.target.closest("[data-nav]");

      if (!nav) return;

      event.preventDefault();
      navigate(nav.dataset.nav);
    });
  }

  function bindActionButtons() {
    document.addEventListener("click", event => {
      const button = event.target.closest("[data-action]");

      if (!button) return;

      const action = button.dataset.action;
      const id = button.dataset.id;

      switch (action) {
        case "study-chapter":
          startStudy(id);
          break;

        case "complete-chapter":
          completeChapter(id);
          break;

        case "edit-chapter":
          editChapter(id);
          break;

        case "delete-chapter":
          deleteChapter(id);
          break;

        case "open-revision":
        case "revise-chapter":
          openRevision(id);
          break;

        case "export-backup":
          exportBackup();
          break;

        case "reset-data":
          resetAllData();
          break;

        case "delete-subject":
          deleteSubject(id);
          break;

        case "go-dashboard":
          navigate("dashboard");
          break;

        case "go-study":
          navigate("study");
          break;

        case "go-chapters":
          navigate("chapters");
          break;

        case "go-revision":
          navigate("revision");
          break;

        case "go-analytics":
          navigate("analytics");
          break;

        case "go-settings":
          navigate("settings");
          break;
      }
    });
  }

  function bindForms() {
    document.addEventListener("submit", event => {
      const form = event.target;

      if (form.matches(
        "#chapterForm, [data-form='add-chapter']"
      )) {
        event.preventDefault();
        handleAddChapterForm(form);
      }

      if (form.matches(
        "#subjectForm, [data-form='add-subject']"
      )) {
        event.preventDefault();
        handleAddSubjectForm(form);
      }
    });
  }

  function bindInputs() {
    document.addEventListener("input", event => {
      const target = event.target;

      if (target.matches(
        "#chapterSearch, [data-chapter-search]"
      )) {
        handleSearch(target.value);
      }
    });

    document.addEventListener("change", event => {
      const target = event.target;

      if (target.matches(
        "#chapterFilter, [data-chapter-filter]"
      )) {
        handleChapterFilter(target.value);
      }

      if (target.matches(
        "#revisionFilter, [data-revision-filter]"
      )) {
        handleRevisionFilter(target.value);
      }

      if (target.matches(
        "#restoreFile, [data-restore-file]"
      )) {
        restoreBackup(target.files[0]);
        target.value = "";
      }
    });
  }

  function bindBackupButtons() {
    const exportButtons = $$(
      "#exportBackup, [data-export-backup]"
    );

    exportButtons.forEach(button => {
      button.addEventListener("click", exportBackup);
    });
  }

  /* ================= UI REFRESH ================= */

  function refreshUI() {
    populateSubjectSelects();

    renderDashboard();
    renderStudyFlow();
    renderChapters();
    renderRevisions();
    renderAnalytics();
    renderSettings();
  }

  /* ================= INITIALIZATION ================= */

  function initialize() {
    console.log("STUDY FLOW initializing...");

    state.subjects = Array.isArray(state.subjects)
      ? state.subjects : [];

    state.chapters = Array.isArray(state.chapters)
      ? state.chapters : [];

    state.sessions = Array.isArray(state.sessions)
      ? state.sessions : [];

    state.revisionHistory = Array.isArray(state.revisionHistory)
      ? state.revisionHistory : [];

    state.settings = state.settings || {};

    bindNavigation();
    bindActionButtons();
    bindForms();
    bindInputs();
    bindBackupButtons();

    populateSubjectSelects();
    refreshUI();

    navigate("dashboard");

    console.log("STUDY FLOW ready.");
  }

  /* ================= PUBLIC APP API ================= */

  window.StudyFlowApp = {
    getState: () => state,
    navigate,
    refresh: refreshUI,
    addChapter,
    addSubject,
    completeChapter,
    startStudy,
    openRevision,
    exportBackup,
    restoreBackup,
    resetAllData
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

})();
      
