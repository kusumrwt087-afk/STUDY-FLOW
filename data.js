"use strict";

/* =========================================
   STUDY FLOW — CENTRAL DATA CONFIGURATION
   File: data.js
========================================= */

window.StudyFlowData = (() => {

  const APP_NAME = "STUDY FLOW";
  const APP_VERSION = "1.0.0";

  // Main localStorage key
  const STORAGE_KEY = "study_flow_data_v1";

  // Confidence rating: 0–10
  // Rating 2 = 1 day
  // Rating 10 = 25 days
  const REVISION_INTERVALS_DAYS = [
    1,  // 0
    1,  // 1
    1,  // 2
    2,  // 3
    4,  // 4
    6,  // 5
    9,  // 6
    13, // 7
    18, // 8
    22, // 9
    25  // 10
  ];

  // Default subjects
  const DEFAULT_SUBJECTS = [
    {
      id: "science",
      name: "Science",
      category: "academic",
      order: 1
    },
    {
      id: "mathematics",
      name: "Mathematics",
      category: "academic",
      order: 2
    },
    {
      id: "social-science",
      name: "Social Science",
      category: "academic",
      order: 3
    },
    {
      id: "english",
      name: "English",
      category: "academic",
      order: 4
    },
    {
      id: "hindi",
      name: "Hindi",
      category: "academic",
      order: 5
    }
  ];

  // Default application settings
  const DEFAULT_SETTINGS = {
    className: "Class 10",
    board: "Uttarakhand Board",
    curriculum: "NCERT",

    dailyNewChapterTarget: 1,
    shortBreakMinutes: 5,

    confidenceIntervals: [...REVISION_INTERVALS_DAYS],

    includeSchoolProgress: false,

    theme: "dark",

    soundEnabled: false,
    notificationsEnabled: false
  };

  // Generate unique IDs
  function createId(prefix = "item") {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }

  // Get current ISO date
  function getCurrentDate() {
    return new Date().toISOString();
  }

  // Create a fresh default application state
  function createInitialState() {
    const now = getCurrentDate();

    return {
      meta: {
        appName: APP_NAME,
        version: APP_VERSION,
        createdAt: now,
        updatedAt: now
      },

      subjects: JSON.parse(
        JSON.stringify(DEFAULT_SUBJECTS)
      ),

      chapters: [],

      studySessions: [],

      revisionHistory: [],

      settings: JSON.parse(
        JSON.stringify(DEFAULT_SETTINGS)
      )
    };
  }

  // Deep clone utility
  function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
  }

  // Confidence validation
  function normalizeConfidence(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return 0;
    }

    return Math.max(0, Math.min(10, Math.round(number)));
  }

  // Get revision interval
  function getRevisionInterval(confidence) {
    const rating = normalizeConfidence(confidence);

    return REVISION_INTERVALS_DAYS[rating];
  }

  // Calculate next revision date
  function getNextRevisionDate(
    confidence,
    fromDate = new Date()
  ) {
    const interval = getRevisionInterval(confidence);

    const date = new Date(fromDate);

    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid revision starting date.");
    }

    date.setDate(date.getDate() + interval);

    return date.toISOString();
  }

  // Create a new subject
  function createSubject(name) {
    const cleanName = String(name || "").trim();

    if (!cleanName) {
      throw new Error("Subject name cannot be empty.");
    }

    return {
      id: createId("subject"),
      name: cleanName,
      category: "academic",
      order: Date.now(),
      createdAt: getCurrentDate()
    };
  }

  // Create a new chapter
  function createChapter(subjectId, title) {
    const cleanTitle = String(title || "").trim();

    if (!subjectId) {
      throw new Error("Select a subject first.");
    }

    if (!cleanTitle) {
      throw new Error("Chapter title cannot be empty.");
    }

    return {
      id: createId("chapter"),

      subjectId: subjectId,
      title: cleanTitle,

      status: "not-started",

      order: Date.now(),

      createdAt: getCurrentDate(),
      startedAt: null,
      completedAt: null,

      lastStudiedAt: null,

      confidence: null,

      nextRevisionAt: null,

      revisionCount: 0,

      totalStudyMinutes: 0,

      notes: "",

      tags: []
    };
  }

  // Create a study session record
  function createStudySession({
    chapterId,
    subjectId,
    type = "new",
    method = "active-recall",
    durationMinutes = 0,
    confidenceBefore = null,
    confidenceAfter = null,
    notes = ""
  }) {

    if (!chapterId || !subjectId) {
      throw new Error("Chapter and subject are required.");
    }

    const validTypes = ["new", "revision"];

    const validMethods = [
      "active-recall",
      "feynman",
      "reading",
      "practice",
      "other"
    ];

    if (!validTypes.includes(type)) {
      throw new Error("Invalid study session type.");
    }

    if (!validMethods.includes(method)) {
      throw new Error("Invalid study method.");
    }

    const duration = Math.max(
      0,
      Number(durationMinutes) || 0
    );

    return {
      id: createId("session"),

      chapterId,
      subjectId,

      type,
      method,

      durationMinutes: duration,

      confidenceBefore:
        confidenceBefore === null
          ? null
          : normalizeConfidence(confidenceBefore),

      confidenceAfter:
        confidenceAfter === null
          ? null
          : normalizeConfidence(confidenceAfter),

      notes: String(notes || "").trim(),

      studiedAt: getCurrentDate()
    };
  }

  // Create a revision history record
  function createRevisionRecord({
    chapterId,
    subjectId,
    confidence,
    notes = "",
    completed = true
  }) {

    if (!chapterId || !subjectId) {
      throw new Error("Chapter and subject are required.");
    }

    const rating = normalizeConfidence(confidence);
    const now = getCurrentDate();

    return {
      id: createId("revision"),

      chapterId,
      subjectId,

      confidence: rating,

      intervalDays: getRevisionInterval(rating),

      completed: Boolean(completed),

      notes: String(notes || "").trim(),

      revisedAt: now,

      nextRevisionAt: completed
        ? getNextRevisionDate(rating, now)
        : null
    };
  }

  // Check whether application data has a valid structure
  function isValidState(data) {
    if (!data || typeof data !== "object") {
      return false;
    }

    if (!Array.isArray(data.subjects)) {
      return false;
    }

    if (!Array.isArray(data.chapters)) {
      return false;
    }

    if (!Array.isArray(data.studySessions)) {
      return false;
    }

    if (!Array.isArray(data.revisionHistory)) {
      return false;
    }

    if (
      !data.settings ||
      typeof data.settings !== "object"
    ) {
      return false;
    }

    return true;
  }

  // Export all public data
  function prepareExport(data) {
    if (!isValidState(data)) {
      throw new Error("Cannot export invalid application data.");
    }

    return {
      exportedAt: getCurrentDate(),
      appName: APP_NAME,
      appVersion: APP_VERSION,
      data: cloneData(data)
    };
  }

  // Read imported backup data
  function readImportedBackup(backup) {
    if (!backup || typeof backup !== "object") {
      throw new Error("Invalid backup file.");
    }

    const importedData = backup.data || backup;

    if (!isValidState(importedData)) {
      throw new Error("Backup file has an invalid data structure.");
    }

    return cloneData(importedData);
  }

  // Public API
  return Object.freeze({

    APP_NAME,
    APP_VERSION,
    STORAGE_KEY,

    REVISION_INTERVALS_DAYS,

    DEFAULT_SUBJECTS,
    DEFAULT_SETTINGS,

    createId,
    getCurrentDate,

    createInitialState,
    cloneData,

    normalizeConfidence,
    getRevisionInterval,
    getNextRevisionDate,

    createSubject,
    createChapter,

    createStudySession,
    createRevisionRecord,

    isValidState,

    prepareExport,
    readImportedBackup

  });

})();
