"use client";

/**
 * Month + year pickers.
 *
 * Stored as `YYYY-MM` so ordering is a string compare and a "present" end
 * date is representable as an empty string rather than a sentinel value that
 * has to be special-cased in every comparison.
 *
 * A `present` toggle replaces the end picker rather than disabling it: a
 * visible-but-inert field reads as broken, whereas a field that is simply not
 * there does not.
 */

import { useEffect, useState } from "react";

import type { Locale } from "@helpmycv/shared";

import { FieldLabel } from "@/components/ui/field-label";
import { Select } from "@/components/ui/select";
import { MONTHS, YEARS } from "@/lib/format";

interface MonthYearPickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export function MonthYearPicker({
  id,
  label,
  value,
  onChange,
  locale,
  allowEmpty = true,
  emptyLabel,
}: MonthYearPickerProps) {
  // Each half is committed to local state the moment it is chosen.
  //
  // Deriving both halves from `value` on every render — and writing back through
  // `onChange` after each selection — cannot represent a half-filled pair:
  // `setPart` only emitted `YYYY-MM` once BOTH halves were set, so choosing a
  // month wrote "" back to the parent, the month reverted to its placeholder,
  // and the field could never be filled in either order. `value` is only read
  // on mount and when it changes from outside (a loaded resume, or the "clear
  // this entry" button); the two selects write straight to local state instead.
  const [selected, setSelected] = useState(() => {
    const [parsedYear = "", parsedMonth = ""] = value ? value.split("-") : [];
    return { year: parsedYear, month: parsedMonth };
  });

  // Adopt a value that changed outside this component. Without this the selects
  // would keep showing the user's last choice after the parent reset the entry,
  // and a saved resume would reopen with stale dates.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    const [parsedYear = "", parsedMonth = ""] = value ? value.split("-") : [];
    setSelected({ year: parsedYear, month: parsedMonth });
  }

  const { year, month } = selected;

  function setYear(nextYear: string) {
    setSelected((current) => ({ ...current, year: nextYear }));
  }

  function setMonth(nextMonth: string) {
    setSelected((current) => ({ ...current, month: nextMonth }));
  }

  // Emit the pair once it is complete, and clear the field when either half is
  // emptied. One effect keeps both rules in a single place; doing it inside each
  // onChange handler is how the two halves previously disagreed about whether
  // the pair was still valid.
  //
  // Skipped on the first render so mounting an editor does not report an empty
  // value over a freshly loaded entry.
  const [emitted, setEmitted] = useState(false);
  useEffect(() => {
    if (!emitted) {
      setEmitted(true);
      return;
    }
    onChange(year && month ? `${year}-${month}` : "");
    // `onChange` is a fresh closure on every parent render, so depending on it
    // here would loop. The selected halves are what actually changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={`${id}-month`}>{label}</FieldLabel>
      <div className="flex gap-2">
        <Select id={`${id}-month`} value={month} onChange={(event) => setMonth(event.target.value)}>
          {allowEmpty ? <option value="">{emptyLabel ?? "—"}</option> : null}
          {MONTHS[locale].map((name, index) => {
            const monthValue = String(index + 1).padStart(2, "0");
            return (
              <option key={monthValue} value={monthValue}>
                {name}
              </option>
            );
          })}
        </Select>
        <Select id={`${id}-year`} value={year} onChange={(event) => setYear(event.target.value)}>
          {allowEmpty ? <option value="">{emptyLabel ?? "—"}</option> : null}
          {YEARS.map((yearValue) => (
            <option key={yearValue} value={yearValue}>
              {yearValue}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
