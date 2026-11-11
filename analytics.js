"use strict";

/* =========================================
   STUDY FLOW — ANALYTICS ENGINE
   File: analytics.js
========================================= */

window.StudyFlowAnalytics = (() => {
  const DATA = window.StudyFlowData;

  if (!DATA) {
    throw new Error("data.js must load before analytics.js");
  }

  // Get all chapters of a subject
  function getChaptersBySubject(state, subjectId) {
    return state.chapters.filter(
      chapter => chapter.subjectId === subjectId
    );
  }

  // Calculate subject-wise statistics
  function getSubjectStats(state, subjectId) {
    const chapters = getChaptersBySubject(state, subjectId);
    const total = chapters.length;

    const completed = chapters.filter(
      chapter => chapter.status === "completed"
    ).length;

    const inProgress = chapters.filter(
      chapter => chapter.status === "in-progress"
    ).length;

    const notStarted = chapters.filter(
      chapter => chapter.status === "not-started"
    ).length;

    const rated = chapters.filter(
      chapter =>
        chapter.status === "completed" &&
        chapter.confidence !== null &&
        Number.isFinite(Number(chapter.confidence))
    );

    const averageConfidence = rated.length
      ? Number((
          rated.reduce(
            (sum, chapter) => sum + Number(chapter.confidence),
            0
          ) / rated.length
        ).toFixed(1))
      : 0;

    return {
      subjectId,
      total,
      completed,
      inProgress,
      notStarted,
      remaining: total - completed,

      completionPercent: total
        ? Math.round((completed / total) * 100)
        : 0,

      averageConfidence,
      ratedChapters: rated.length
    };
  }

  // Calculate overall syllabus statistics
  function getOverallStats(state) {
    const total = state.chapters.length;

    const completed = state.chapters.filter(
      chapter => chapter.status === "completed"
    ).length;

    const inProgress = state.chapters.filter(
      chapter => chapter.status === "in-progress"
    ).length;

    const notStarted = state.chapters.filter(
      chapter => chapter.status === "not-started"
    ).length;

    const rated = state.chapters.filter(
      chapter =>
        chapter.status === "completed" &&
        chapter.confidence !== null &&
        Number.isFinite(Number(chapter.confidence))
    );

    const averageConfidence = rated.length
      ? Number((
          rated.reduce(
            (sum, chapter) => sum + Number(chapter.confidence),
            0
          ) / rated.length
        ).toFixed(1))
      : 0;

    const totalMinutes = state.studySessions.reduce(
      (sum, session) =>
        sum + Math.max(
          0,
          Number(session.durationMinutes) || 0
        ),
      0
    );

    return {
      total,
      completed,
      inProgress,
      notStarted,
      remaining: total - completed,

      completionPercent: total
        ? Math.round((completed / total) * 100)
        : 0,

      averageConfidence,
      ratedChapters: rated.length,

      totalStudyMinutes: totalMinutes,

      totalStudyHours: Number(
        (totalMinutes / 60).toFixed(1)
      ),

      totalSessions: state.studySessions.length
    };
  }

  // Generate daily study activity
  function getDailyActivity(
    state,
    days = 7,
    referenceDate = new Date()
  ) {
    const count = Math.max(
      1,
      Math.min(365, Number(days) || 7)
    );

    const end = new Date(referenceDate);
    end.setHours(0, 0, 0, 0);

    const result = [];

    for (let offset = count - 1; offset >= 0; offset--) {
      const date = new Date(end);

      date.setDate(end.getDate() - offset);

      const start = new Date(date);

      const next = new Date(date);
      next.setDate(next.getDate() + 1);

      const sessions = state.studySessions.filter(session => {
        const studiedAt = new Date(session.studiedAt);

        return (
          studiedAt >= start &&
          studiedAt < next
        );
      });

      const minutes = sessions.reduce(
        (sum, session) =>
          sum + Math.max(
            0,
            Number(session.durationMinutes) || 0
          ),
        0
      );

      result.push({
        date: date.toISOString().slice(0, 10),

        label: date.toLocaleDateString(undefined, {
          weekday: "short"
        }),

        sessions: sessions.length,
        minutes,

        hours: Number(
          (minutes / 60).toFixed(1)
        )
      });
    }

    return result;
  }

  // Subject-wise analytics
  function getSubjectBreakdown(state) {
    return state.subjects.map(subject => ({
      subjectId: subject.id,
      subjectName: subject.name,

      ...getSubjectStats(state, subject.id)
    }));
  }

  // Compare study methods
  function getMethodBreakdown(state) {
    const methods = {};

    state.studySessions.forEach(session => {
      const method = session.method || "other";

      if (!methods[method]) {
        methods[method] = {
          method,
          sessions: 0,
          minutes: 0
        };
      }

      methods[method].sessions += 1;

      methods[method].minutes += Math.max(
        0,
        Number(session.durationMinutes) || 0
      );
    });

    return Object.values(methods).sort(
      (a, b) => b.minutes - a.minutes
    );
  }

  // Get recently completed study sessions
  function getRecentSessions(state, limit = 10) {
    const safeLimit = Math.max(
      1,
      Math.min(100, Number(limit) || 10)
    );

    return [...state.studySessions]
      .sort(
        (a, b) =>
          new Date(b.studiedAt) -
          new Date(a.studiedAt)
      )
      .slice(0, safeLimit)
      .map(session => {
        const chapter = state.chapters.find(
          item => item.id === session.chapterId
        );

        const subject = state.subjects.find(
          item => item.id === session.subjectId
        );

        return {
          ...session,

          chapterTitle: chapter
            ? chapter.title
            : "Deleted chapter",

          subjectName: subject
            ? subject.name
            : "Unknown subject"
        };
      });
  }

  // Calculate consecutive study days
  function getStudyStreak(
    state,
    referenceDate = new Date()
  ) {
    const activeDates = new Set(
      state.studySessions
        .map(session => {
          const date = new Date(session.studiedAt);

          return Number.isNaN(date.getTime())
            ? null
            : date.toISOString().slice(0, 10);
        })
        .filter(Boolean)
    );

    const today = new Date(referenceDate);
    today.setHours(0, 0, 0, 0);

    const todayKey = today.toISOString().slice(0, 10);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayKey = yesterday.toISOString().slice(0, 10);

    if (
      !activeDates.has(todayKey) &&
      !activeDates.has(yesterdayKey)
    ) {
      return {
        current: 0,
        activeToday: false
      };
    }

    const cursor = new Date(
      activeDates.has(todayKey)
        ? today
        : yesterday
    );

    let streak = 0;

    while (
      activeDates.has(
        cursor.toISOString().slice(0, 10)
      )
    ) {
      streak++;

      cursor.setDate(
        cursor.getDate() - 1
      );
    }

    return {
      current: streak,
      activeToday: activeDates.has(todayKey)
    };
  }

  // Complete dashboard analytics
  function getDashboardAnalytics(state) {
    return {
      overall: getOverallStats(state),

      subjects: getSubjectBreakdown(state),

      weeklyActivity: getDailyActivity(state, 7),

      retention: window.StudyFlowRevision
        ? window.StudyFlowRevision.getRetentionOverview(state)
        : null,

      streak: getStudyStreak(state),

      recentSessions: getRecentSessions(state, 5)
    };
  }

  // Public API
  return Object.freeze({
    getChaptersBySubject,
    getSubjectStats,
    getOverallStats,
    getDailyActivity,
    getSubjectBreakdown,
    getMethodBreakdown,
    getRecentSessions,
    getStudyStreak,
    getDashboardAnalytics
  });

})();
