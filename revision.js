"use strict";

/* =========================================
   STUDY FLOW — SMART REVISION ENGINE
   File: revision.js
========================================= */

window.StudyFlowRevision = (() => {
  const DATA = window.StudyFlowData;

  if (!DATA) {
    throw new Error("data.js must load before revision.js");
  }

  // Get all chapters that are due for revision
  function getDueRevisions(state, referenceDate = new Date()) {
    const now = new Date(referenceDate);

    return state.chapters
      .filter(chapter => {
        if (!chapter.nextRevisionAt) return false;

        const dueDate = new Date(chapter.nextRevisionAt);

        return (
          !Number.isNaN(dueDate.getTime()) &&
          dueDate <= now
        );
      })
      .sort((a, b) => {
        return (
          new Date(a.nextRevisionAt) -
          new Date(b.nextRevisionAt)
        );
      });
  }

  // Get upcoming revisions
  function getUpcomingRevisions(
    state,
    daysAhead = 7,
    referenceDate = new Date()
  ) {
    const now = new Date(referenceDate);
    const end = new Date(now);

    end.setDate(end.getDate() + daysAhead);

    return state.chapters
      .filter(chapter => {
        if (!chapter.nextRevisionAt) return false;

        const due = new Date(chapter.nextRevisionAt);

        return due > now && due <= end;
      })
      .sort((a, b) => {
        return (
          new Date(a.nextRevisionAt) -
          new Date(b.nextRevisionAt)
        );
      });
  }

  // Get overdue revision count
  function getOverdueCount(state, referenceDate = new Date()) {
    return getDueRevisions(state, referenceDate).length;
  }

  // Get subject name for a chapter
  function getSubjectName(state, chapter) {
    const subject = state.subjects.find(
      item => item.id === chapter.subjectId
    );

    return subject ? subject.name : "Unknown Subject";
  }

  // Calculate next revision date
  function calculateNextDate(confidence, fromDate = new Date()) {
    return DATA.getNextRevisionDate(confidence, fromDate);
  }

  // Complete a revision
  function completeRevision(
    state,
    chapterId,
    confidence,
    notes = ""
  ) {
    const chapter = state.chapters.find(
      item => item.id === chapterId
    );

    if (!chapter) {
      throw new Error("Chapter not found.");
    }

    if (chapter.status !== "completed") {
      throw new Error(
        "Complete the chapter before scheduling revisions."
      );
    }

    const rating = DATA.normalizeConfidence(confidence);

    const record = DATA.createRevisionRecord({
      chapterId: chapter.id,
      subjectId: chapter.subjectId,
      confidence: rating,
      notes,
      completed: true
    });

    chapter.confidence = rating;
    chapter.lastStudiedAt = record.revisedAt;
    chapter.nextRevisionAt = record.nextRevisionAt;
    chapter.revisionCount =
      (chapter.revisionCount || 0) + 1;

    state.revisionHistory.push(record);

    return {
      chapter,
      record,
      nextRevisionAt: record.nextRevisionAt,
      intervalDays: record.intervalDays
    };
  }

  // Get chapter revision history
  function getChapterHistory(state, chapterId) {
    return state.revisionHistory
      .filter(item => item.chapterId === chapterId)
      .sort((a, b) => {
        return (
          new Date(b.revisedAt) -
          new Date(a.revisedAt)
        );
      });
  }

  // Get retention overview
  function getRetentionOverview(state) {
    const completed = state.chapters.filter(
      chapter => chapter.status === "completed"
    );

    if (completed.length === 0) {
      return {
        total: 0,
        averageConfidence: 0,
        strong: 0,
        medium: 0,
        weak: 0,
        unrated: 0
      };
    }

    const rated = completed.filter(
      chapter => chapter.confidence !== null
    );

    const totalConfidence = rated.reduce(
      (sum, chapter) => sum + chapter.confidence,
      0
    );

    return {
      total: completed.length,

      averageConfidence: rated.length
        ? Number(
            (totalConfidence / rated.length).toFixed(1)
          )
        : 0,

      strong: rated.filter(
        chapter => chapter.confidence >= 8
      ).length,

      medium: rated.filter(
        chapter =>
          chapter.confidence >= 5 &&
          chapter.confidence < 8
      ).length,

      weak: rated.filter(
        chapter => chapter.confidence < 5
      ).length,

      unrated: completed.length - rated.length
    };
  }

  // Find chapters that need attention
  function getWeakChapters(state) {
    return state.chapters
      .filter(chapter => {
        return (
          chapter.status === "completed" &&
          chapter.confidence !== null &&
          chapter.confidence < 5
        );
      })
      .sort((a, b) => {
        return a.confidence - b.confidence;
      });
  }

  // Build complete revision queue
  function getRevisionQueue(state, referenceDate = new Date()) {
    const due = getDueRevisions(state, referenceDate);

    const upcoming = getUpcomingRevisions(
      state,
      7,
      referenceDate
    );

    const weak = getWeakChapters(state);

    return {
      due: due.map(chapter => ({
        ...chapter,
        subjectName: getSubjectName(state, chapter),
        revisionStatus: "due"
      })),

      upcoming: upcoming.map(chapter => ({
        ...chapter,
        subjectName: getSubjectName(state, chapter),
        revisionStatus: "upcoming"
      })),

      weak: weak.map(chapter => ({
        ...chapter,
        subjectName: getSubjectName(state, chapter),
        revisionStatus: "weak"
      }))
    };
  }

  // Public API
  return Object.freeze({
    getDueRevisions,
    getUpcomingRevisions,
    getOverdueCount,
    getSubjectName,
    calculateNextDate,
    completeRevision,
    getChapterHistory,
    getRetentionOverview,
    getWeakChapters,
    getRevisionQueue
  });

})();
