
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { ShiftType } from '@/lib/schemas/shift-handover-schema';

const SHIFT_CHANGE_TIMES = [7, 19]; // 7 AM and 7 PM
const REMINDER_KEY_PREFIX = 'shiftReminder_';

interface UseShiftChangeReminderReturn {
  showReminder: boolean;
  confirmReminder: () => void;
  openHandoverDialog: () => void;
  shiftType: ShiftType | null;
}

export function useShiftChangeReminder(isUserLoggedIn: boolean): UseShiftChangeReminderReturn {
  const [showReminder, setShowReminder] = useState(false);
  const [showHandover, setShowHandover] = useState(false);
  const [shiftType, setShiftType] = useState<ShiftType | null>(null);

  const getReminderKey = (date: Date, hour: number) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${REMINDER_KEY_PREFIX}${year}-${month}-${day}_${hour}`;
  };

  const getShiftType = (hour: number): ShiftType => {
    return hour >= 7 && hour < 19 ? 'morning' : 'evening';
  };

  const checkShiftChange = useCallback(() => {
    if (!isUserLoggedIn) return;

    const now = new Date();
    const currentHour = now.getHours();

    // Check if the current hour is a shift change hour
    if (SHIFT_CHANGE_TIMES.includes(currentHour)) {
      const reminderKey = getReminderKey(now, currentHour);
      setShiftType(getShiftType(currentHour));
      
      try {
        const hasBeenShown = localStorage.getItem(reminderKey);
        if (!hasBeenShown) {
          setShowReminder(true);
        }
      } catch (error) {
        console.warn("Could not use localStorage for shift reminder:", error);
        // Fallback for environments where localStorage is not available.
        // This might show the reminder more than once, but it's better than crashing.
        setShowReminder(true);
      }
    }
  }, [isUserLoggedIn]);

  useEffect(() => {
    // Check immediately on component mount
    checkShiftChange();

    // Set up an interval to check every minute
    const intervalId = setInterval(checkShiftChange, 60 * 1000);

    return () => clearInterval(intervalId);
  }, [checkShiftChange]);

  const confirmReminder = useCallback(() => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Only set the key if it's a valid shift change hour to avoid incorrect keys
    if (SHIFT_CHANGE_TIMES.includes(currentHour)) {
      const reminderKey = getReminderKey(now, currentHour);
      try {
        localStorage.setItem(reminderKey, 'true');
      } catch (error) {
        console.warn("Could not use localStorage to set shift reminder:", error);
      }
    }
    setShowReminder(false);
  }, []);

  const openHandoverDialog = useCallback(() => {
    setShowHandover(true);
    setShowReminder(false);
    confirmReminder();
  }, [confirmReminder]);

  return { showReminder, confirmReminder, openHandoverDialog, shiftType };
}
