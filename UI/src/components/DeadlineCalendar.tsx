// Provides the date picker used for real-life and in-game task deadlines.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "cs2/ui";
import { formatDateInput, isValidDateInput } from "../model";
import { DateFormat, DeadlineMode } from "../types/contracts";
import { useEscapeDismissal } from "./useEscapeDismissal";
import styles from "./mainPanel.module.scss";
const calendarMonths = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const calendarWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function calendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
function calendarInput(date: Date) {
  return `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;
}
function calendarToday() {
  return calendarInput(new Date());
}
function calendarMonth(value: string) {
  return value.slice(0, 7);
}
function addCalendarDays(value: string, days: number) {
  const next = calendarDate(value);
  next.setUTCDate(next.getUTCDate() + days);
  return calendarInput(next);
}
export function DeadlineCalendar({
  deadlineMode,
  dateFormat,
  value,
  currentDate,
  open,
  onChange,
  onOpenChange,
  overlayHost,
}: {
  deadlineMode: DeadlineMode;
  dateFormat: DateFormat;
  value: string;
  currentDate: string;
  open: boolean;
  onChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  overlayHost: { current: HTMLDivElement | null };
}) {
  const reference = isValidDateInput(currentDate) ? currentDate : calendarToday();
  const [monthKey, setMonthKey] = useState(() =>
    calendarMonth(isValidDateInput(value) ? value : reference),
  );
  useEffect(() => {
    if (!open) setMonthKey(calendarMonth(isValidDateInput(value) ? value : reference));
  }, [deadlineMode, reference, value, open]);
  const monthStart = calendarDate(`${monthKey}-01`);
  const monthIndex = monthStart.getUTCMonth();
  const firstCell = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthIndex, 1 - monthStart.getUTCDay()),
  );
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell.getTime());
    date.setUTCDate(firstCell.getUTCDate() + index);
    return {
      value: calendarInput(date),
      label: date.getUTCDate(),
      outside: date.getUTCMonth() !== monthIndex,
    };
  });
  const changeMonth = (offset: number) => {
    const next = new Date(Date.UTC(monthStart.getUTCFullYear(), monthIndex + offset, 1));
    setMonthKey(calendarMonth(calendarInput(next)));
  };
  const label = deadlineMode === "game" ? "In-game deadline" : "Real-life deadline";
  const context = deadlineMode === "game" ? "City today" : "Today";
  useEscapeDismissal(
    110,
    () => {
      onOpenChange(false);
      return true;
    },
    open,
  );
  // Render inside the editor host instead of the field so the popup clears the
  // panel's clipped grid while still closing when the editor background is clicked.
  const popup =
    open && overlayHost.current
      ? createPortal(
          <div className={styles.calendarOverlay} onMouseDown={() => onOpenChange(false)}>
            <div className={styles.calendarPanel} onMouseDown={(event) => event.stopPropagation()}>
              <div className={styles.calendarHeader}>
                <Button variant="flat" onSelect={() => changeMonth(-1)}>
                  &lt;
                </Button>
                <strong>
                  {calendarMonths[monthIndex]} {monthStart.getUTCFullYear()}
                </strong>
                <Button variant="flat" onSelect={() => changeMonth(1)}>
                  &gt;
                </Button>
              </div>
              <div className={styles.calendarWeekdays}>
                {calendarWeekdays.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className={styles.calendarWeeks}>
                {Array.from({ length: 6 }, (_, week) => (
                  <div key={week}>
                    {days.slice(week * 7, week * 7 + 7).map((day) => (
                      <Button
                        key={day.value}
                        variant="flat"
                        selected={day.value === value}
                        className={`${styles.calendarDay} ${day.outside ? styles.calendarOutside : ""} ${day.value === reference ? styles.calendarToday : ""} ${day.value === value ? styles.calendarSelected : ""}`}
                        onSelect={() => {
                          onChange(day.value);
                          onOpenChange(false);
                        }}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                ))}
              </div>
              <div className={styles.calendarFooter}>
                <span>
                  {context}: {formatDateInput(reference, dateFormat)}
                </span>
                <div>
                  <Button
                    variant="flat"
                    onSelect={() => {
                      onChange(reference);
                      onOpenChange(false);
                    }}
                  >
                    {deadlineMode === "game" ? "City today" : "Today"}
                  </Button>
                  {deadlineMode === "game" && (
                    <Button
                      variant="flat"
                      onSelect={() => {
                        onChange(addCalendarDays(reference, 7));
                        onOpenChange(false);
                      }}
                    >
                      Next week
                    </Button>
                  )}
                  <Button
                    variant="flat"
                    onSelect={() => {
                      onChange("");
                      onOpenChange(false);
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          overlayHost.current,
        )
      : null;
  return (
    <div className={styles.deadlineCalendar} onMouseDown={(event) => event.stopPropagation()}>
      <span>{label}</span>
      <Button
        variant="flat"
        aria-label={label}
        title={`Set ${label}`}
        className={styles.deadlineTrigger}
        onSelect={() => onOpenChange(!open)}
      >
        <span className={styles.calendarGlyph} aria-hidden="true"></span>
        <span>
          {value
            ? `${deadlineMode === "game" ? "City" : "Real"} \u00B7 ${formatDateInput(value, dateFormat)}`
            : "No deadline"}
        </span>
        <span>{open ? "-" : "+"}</span>
      </Button>
      {popup}
    </div>
  );
}
