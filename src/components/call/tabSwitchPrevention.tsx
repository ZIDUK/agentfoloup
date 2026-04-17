"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProctoringEvent } from "@/types/response";

/**
 * Unified proctoring hook — tracks tab visibility changes, window focus/blur,
 * and fullscreen exits. Pass isActive=true only after the interview has started
 * so events aren't logged during the pre-start setup phase.
 *
 * Bug fix: previously a second hook instance was created inside TabSwitchWarning,
 * causing independent state. Now TabSwitchWarning receives state via props.
 */
const useTabSwitchPrevention = (isActive: boolean = false) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [windowSwitchCount, setWindowSwitchCount] = useState(0);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  // Use a ref for events so getProctoringData always returns the latest list
  // without needing it in every useCallback dependency array.
  const eventsRef = useRef<ProctoringEvent[]>([]);
  // When a tab becomes hidden, a window blur fires too — suppress the redundant blur.
  const tabHiddenRef = useRef(false);

  const addEvent = useCallback((type: ProctoringEvent["type"]) => {
    eventsRef.current = [...eventsRef.current, { type, timestamp: Date.now() }];
  }, []);

  const handleUnderstand = useCallback(() => {
    setIsDialogOpen(false);
    // Re-request fullscreen after the candidate dismisses the warning.
    if (typeof document !== "undefined" && document.fullscreenEnabled && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  // Request fullscreen when the interview starts; exit when it ends.
  useEffect(() => {
    if (!isActive) return;
    if (typeof document !== "undefined" && document.fullscreenEnabled) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    return () => {
      // Exit fullscreen when proctoring deactivates so the fullscreenchange
      // event fires after the listener below has already been removed.
      if (typeof document !== "undefined" && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [isActive]);

  // Tab visibility change (browser tab hidden / visible).
  useEffect(() => {
    if (!isActive) return;
    const onVisibilityChange = () => {
      if (document.hidden) {
        tabHiddenRef.current = true;
        setTabSwitchCount((c) => c + 1);
        addEvent("tab_hidden");
        setDialogMessage(
          "Switching tabs is recorded and will be flagged in your assessment.",
        );
        setIsDialogOpen(true);
      } else {
        // Reset flag a moment after the tab regains visibility.
        setTimeout(() => {
          tabHiddenRef.current = false;
        }, 500);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [isActive, addEvent]);

  // Window blur — candidate switched to another application.
  // Suppressed when the tab itself was hidden (same user action, different event).
  useEffect(() => {
    if (!isActive) return;
    const onBlur = () => {
      if (!tabHiddenRef.current) {
        setWindowSwitchCount((c) => c + 1);
        addEvent("window_blur");
        setDialogMessage(
          "Leaving the browser window is recorded and will be flagged in your assessment.",
        );
        setIsDialogOpen(true);
      }
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [isActive, addEvent]);

  // Fullscreen exit detection.
  useEffect(() => {
    if (!isActive) return;
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setFullscreenExitCount((c) => c + 1);
        addEvent("fullscreen_exit");
        setDialogMessage(
          "Exiting fullscreen is recorded. Please return to fullscreen mode to continue.",
        );
        setIsDialogOpen(true);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [isActive, addEvent]);

  /** Returns a snapshot of all proctoring data suitable for persisting to the DB. */
  const getProctoringData = useCallback(
    () => ({
      tabSwitchCount,
      windowSwitchCount,
      fullscreenExitCount,
      events: eventsRef.current,
    }),
    [tabSwitchCount, windowSwitchCount, fullscreenExitCount],
  );

  return {
    tabSwitchCount,
    windowSwitchCount,
    fullscreenExitCount,
    isDialogOpen,
    dialogMessage,
    handleUnderstand,
    getProctoringData,
  };
};

interface TabSwitchWarningProps {
  isDialogOpen: boolean;
  dialogMessage: string;
  onUnderstand: () => void;
}

/** Presentational component — receives state from the shared hook instance in the parent. */
function TabSwitchWarning({
  isDialogOpen,
  dialogMessage,
  onUnderstand,
}: TabSwitchWarningProps) {
  return (
    <AlertDialog open={isDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Integrity Warning</AlertDialogTitle>
          <AlertDialogDescription>
            {dialogMessage ||
              "This action is being recorded and may affect your assessment."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            className="bg-indigo-400 hover:bg-indigo-600 text-white"
            onClick={onUnderstand}
          >
            I understand
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { TabSwitchWarning, useTabSwitchPrevention };
