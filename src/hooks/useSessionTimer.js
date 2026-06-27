/**
 * src/hooks/useSessionTimer.js
 * Tracks active study time with visibilitychange pause/resume.
 * Returns { elapsed, formatted, todayFormatted, weekFormatted }
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { updateTodayStats, getWeeklyTimeSpent } from '../lib/api.js';

export function useSessionTimer(isActive) {
  const [elapsed, setElapsed] = useState(0);          // seconds this session
  const [todayTotal, setTodayTotal] = useState(0);     // seconds today (from DB)
  const [weekTotal, setWeekTotal] = useState(0);       // seconds this week
  const startRef = useRef(null);
  const intervalRef = useRef(null);
  const savedRef = useRef(0);                          // last saved value

  // Load existing time from DB on mount
  useEffect(() => {
    (async () => {
      const weekT = await getWeeklyTimeSpent();
      setWeekTotal(weekT);
    })();
  }, []);

  // Sync elapsed to Supabase every 30 seconds
  const syncToDb = useCallback(async (secs) => {
    if (secs > savedRef.current) {
      const delta = secs - savedRef.current;
      savedRef.current = secs;
      // We don't have today's total here, so we pass the raw delta
      // The caller should handle todayTotal accumulation
      try {
        await updateTodayStats({ time_spent: todayTotal + secs });
      } catch (e) {
        console.error('Timer sync error:', e);
      }
    }
  }, [todayTotal]);

  useEffect(() => {
    if (isActive) {
      startRef.current = Date.now() - elapsed * 1000;
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const secs = Math.floor((now - startRef.current) / 1000);
        setElapsed(secs);

        // Sync every 30s
        if (secs % 30 === 0 && secs > 0) {
          syncToDb(secs);
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Save on pause
      if (elapsed > 0) {
        syncToDb(elapsed);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive]);

  // Visibility change — pause when tab hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        syncToDb(elapsed);
      } else if (!document.hidden && isActive) {
        startRef.current = Date.now() - elapsed * 1000;
        intervalRef.current = setInterval(() => {
          const secs = Math.floor((Date.now() - startRef.current) / 1000);
          setElapsed(secs);
        }, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isActive, elapsed, syncToDb]);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      return `${hours}s ${mins % 60}dk`;
    }
    return `${mins}dk`;
  };

  return {
    elapsed,
    sessionFormatted: formatTime(elapsed),
    todayFormatted: formatTime(todayTotal + elapsed),
    weekFormatted: formatTime(weekTotal + elapsed),
    setTodayTotal,
  };
}
