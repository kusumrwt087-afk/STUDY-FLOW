"use strict";

/* =========================================
   STUDY FLOW — STORAGE ENGINE
   File: storage.js
========================================= */

window.StudyFlowStorage = (() => {
  const DATA = window.StudyFlowData;

  if (!DATA) {
    throw new Error("data.js must load before storage.js");
  }

  const STORAGE_KEY = DATA.STORAGE_KEY;
  const BACKUP_KEY = STORAGE_KEY + "_backup";

  let currentState = null;

  // Save state to localStorage
  function save(state = currentState) {
    if (!DATA.isValidState(state)) {
      throw new Error("Cannot save invalid application data.");
    }

    try {
      state.meta.updatedAt = DATA.getCurrentDate();

      const serialized = JSON.stringify(state);

      // Preserve previous valid state as backup
      const previous = localStorage.getItem(STORAGE_KEY);

      if (previous) {
        localStorage.setItem(BACKUP_KEY, previous);
      }

      localStorage.setItem(STORAGE_KEY, serialized);

      currentState = state;

      return true;
    } catch (error) {
      console.error("Storage save failed:", error);

      throw new Error(
        "Data could not be saved. Check available device storage."
      );
    }
  }

  // Load saved state
  function load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        currentState = DATA.createInitialState();
        save(currentState);
        return currentState;
      }

      const parsed = JSON.parse(saved);

      if (!DATA.isValidState(parsed)) {
        throw new Error("Saved data structure is invalid.");
      }

      currentState = parsed;

      return currentState;
    } catch (error) {
      console.error("Storage load failed:", error);

      // Try recovering previous backup
      try {
        const backup = localStorage.getItem(BACKUP_KEY);

        if (backup) {
          const recovered = JSON.parse(backup);

          if (DATA.isValidState(recovered)) {
            currentState = recovered;
            save(currentState);

            console.warn("Previous backup recovered.");

            return currentState;
          }
        }
      } catch (backupError) {
        console.error("Backup recovery failed:", backupError);
      }

      throw new Error(
        "Saved data could not be recovered. Exported backups may help restore it."
      );
    }
  }

  // Get current state
  function getState() {
    if (!currentState) {
      return load();
    }

    return currentState;
  }

  // Update state using a callback
  function update(callback) {
    if (typeof callback !== "function") {
      throw new Error("Update requires a function.");
    }

    const state = getState();

    // Keep a rollback copy
    const previous = DATA.cloneData(state);

    try {
      callback(state);

      save(state);

      return state;
    } catch (error) {
      currentState = previous;

      throw error;
    }
  }

  // Reset application data
  function reset() {
    const freshState = DATA.createInitialState();

    save(freshState);

    return freshState;
  }

  // Export data as JSON file
  function exportBackup() {
    const state = getState();

    const backup = DATA.prepareExport(state);

    const blob = new Blob(
      [JSON.stringify(backup, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    const date = new Date()
      .toISOString()
      .slice(0, 10);

    link.href = url;
    link.download = `study-flow-backup-${date}.json`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    return true;
  }

  // Import data from a selected JSON file
  function importBackup(file) {
    return new Promise((resolve, reject) => {
      if (!(file instanceof File)) {
        reject(new Error("Select a valid backup file."));
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);

          const imported =
            DATA.readImportedBackup(parsed);

          save(imported);

          resolve(imported);
        } catch (error) {
          reject(
            new Error(
              error.message || "Could not import backup."
            )
          );
        }
      };

      reader.onerror = () => {
        reject(new Error("Could not read the selected file."));
      };

      reader.readAsText(file);
    });
  }

  // Remove all stored application data
  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BACKUP_KEY);

    currentState = DATA.createInitialState();

    save(currentState);

    return currentState;
  }

  // Check browser storage availability
  function isStorageAvailable() {
    try {
      const testKey = "__study_flow_test__";

      localStorage.setItem(testKey, "ok");
      localStorage.removeItem(testKey);

      return true;
    } catch {
      return false;
    }
  }

  // Public API
  return Object.freeze({
    save,
    load,
    getState,
    update,
    reset,
    exportBackup,
    importBackup,
    clearAll,
    isStorageAvailable
  });

})();
