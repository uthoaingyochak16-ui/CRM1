import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Custom hook for autosaving form data after a debounce period.
 *
 * @param {object} data The form data object to watch for changes.
 * @param {function} saveFn An async function that takes the current data and saves it to the backend.
 * @param {number} debounceTime The time in milliseconds to wait after the last change before saving.
 * @param {boolean} enabled Whether autosave should currently run.
 * @returns {{isSaving: boolean, isSaved: boolean, saveError: string|null, triggerSave: function}} Current autosave status.
 */
export function useAutosave(data, saveFn, _debounceTime = 1000, enabled = true) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const dataRef = useRef(data);
  const saveFnRef = useRef(saveFn);
  const enabledRef = useRef(enabled);
  const dirtyRef = useRef(false);
  const lastSavedSnapshotRef = useRef(null);
  const currentSnapshot = data == null ? null : JSON.stringify(data);

  useEffect(() => {
    dataRef.current = data;
    saveFnRef.current = saveFn;
    enabledRef.current = enabled;
  }, [data, saveFn, enabled]);

  const runSave = useCallback(async (nextData) => {
    const savedData = await saveFnRef.current(nextData);
    lastSavedSnapshotRef.current = JSON.stringify(savedData ?? nextData);
    dirtyRef.current = false;
    setIsSaved(true);
    setSaveError(null);
    return savedData;
  }, []);

  useEffect(() => {
    if (currentSnapshot == null) return;
    if (lastSavedSnapshotRef.current == null) {
      lastSavedSnapshotRef.current = currentSnapshot;
      return;
    }
    dirtyRef.current = currentSnapshot !== lastSavedSnapshotRef.current;
    setIsSaved(false);
  }, [currentSnapshot]);

  useEffect(() => {
    const saveOnExit = () => {
      if (enabledRef.current && dirtyRef.current) void saveFnRef.current(dataRef.current);
    };
    window.addEventListener("pagehide", saveOnExit);
    return () => {
      window.removeEventListener("pagehide", saveOnExit);
      saveOnExit();
    };
  }, []);

  async function triggerSave() {
    if (!enabled) return dataRef.current;
    setIsSaving(true);
    setIsSaved(false);
    setSaveError(null);

    try {
      return await runSave(dataRef.current);
    } catch (err) {
      setSaveError(err.response?.data?.detail || "Failed to save changes.");
      throw err;
    } finally {
      setIsSaving(false);
    }
  }

  return { isSaving, isSaved, isDirty: dirtyRef.current, saveError, triggerSave };
}
