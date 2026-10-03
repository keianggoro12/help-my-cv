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
  const [year, month] = value ? value.split("-") : ["", ""];

  function setPart(nextYear: string, nextMonth: string) {
    onChange(nextYear && nextMonth ? `${nextYear}-${nextMonth}` : "");
  }

  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={`${id}-month`}>{label}</FieldLabel>
      <div className="flex gap-2">
        <Select
          id={`${id}-month`}
          value={month}
          onChange={(event) => setPart(year, event.target.value)}
        >
          {allowEmpty ? <option value="">{emptyLabel ?? "—"}</option> : null}
          {MONTHS[locale].map((name, index) => {
            const value = String(index + 1).padStart(2, "0");
            return (
              <option key={value} value={value}>
                {name}
              </option>
            );
          })}
        </Select>
        <Select id={`${id}-year`} value={year} onChange={(event) => setPart(event.target.value, month)}>
          {allowEmpty ? <option value="">{emptyLabel ?? "—"}</option> : null}
          {YEARS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
