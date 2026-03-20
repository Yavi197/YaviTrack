import { differenceInYears } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TimestampLike = {
  toDate?: () => Date;
  seconds?: number;
  nanoseconds?: number;
  _seconds?: number;
  _nanoseconds?: number;
};

export type DateInputValue = string | number | Date | TimestampLike | null | undefined;

const isValidDate = (value: Date | null | undefined): value is Date =>
  value instanceof Date && !isNaN(value.getTime());

const parseDelimitedDateString = (raw: string): Date | null => {
  const parts = raw.split(/[-/]/).map((part) => part.trim());
  if (parts.length !== 3) return null;

  let day: number;
  let month: number;
  let year: number;

  if (parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else if (parts[2].length === 4) {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  } else {
    return null;
  }

  if (month > 12) {
    [day, month] = [month, day];
  }

  if ([day, month, year].some((value) => Number.isNaN(value))) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  return isValidDate(date) ? date : null;
};

const tryParseStringToDate = (value: string): Date | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const delimited = parseDelimitedDateString(trimmed);
  if (delimited) return delimited;

  const fallback = new Date(trimmed);
  return isValidDate(fallback) ? fallback : null;
};

const getSecondsFromTimestampLike = (value: TimestampLike): number | null => {
  if (typeof value.seconds === "number") return value.seconds;
  if (typeof value._seconds === "number") return value._seconds;
  return null;
};

export const toDateValue = (value?: DateInputValue): Date | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return isValidDate(value) ? value : null;
  if (typeof value === "string") return tryParseStringToDate(value);
  if (typeof value === "number") {
    const date = new Date(value);
    return isValidDate(date) ? date : null;
  }

  if (typeof (value as TimestampLike).toDate === "function") {
    const converted = (value as TimestampLike).toDate?.();
    return isValidDate(converted) ? converted : null;
  }

  if (typeof value === "object") {
    const seconds = getSecondsFromTimestampLike(value as TimestampLike);
    if (seconds !== null) {
      const date = new Date(seconds * 1000);
      return isValidDate(date) ? date : null;
    }
  }

  return null;
};

export const getAgeFromBirthDate = (birthDate?: DateInputValue): number | null => {
  const parsedDate = toDateValue(birthDate);
  if (!parsedDate) return null;
  return differenceInYears(new Date(), parsedDate);
};
