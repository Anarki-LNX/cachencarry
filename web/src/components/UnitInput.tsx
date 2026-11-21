import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { Input, Select } from "./Controls";

export interface Unit {
  label: string;
  factor: number;
}

export const SIZE_UNITS: Unit[] = [
  { label: "MiB", factor: 2 ** 20 },
  { label: "GiB", factor: 2 ** 30 },
  { label: "TiB", factor: 2 ** 40 },
];

export const RATE_UNITS: Unit[] = [
  { label: "KiB/s", factor: 2 ** 10 },
  { label: "MiB/s", factor: 2 ** 20 },
];

/** The largest unit that expresses the value without a long fraction. */
function bestUnit(value: number, units: Unit[], fallback: number): number {
  if (value <= 0) return fallback;
  for (let i = units.length - 1; i >= 0; i--) {
    const q = value / units[i].factor;
    if (q >= 1 && Math.abs(q * 100 - Math.round(q * 100)) < 1e-6) return units[i].factor;
  }
  return units[0].factor;
}

/** Number + unit editor for a quantity held in a base unit (bytes, bytes/s). 0 means "unlimited". */
export function UnitInput({
  id,
  value,
  onChange,
  units,
  defaultUnit,
  label,
  ...aria
}: {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  units: Unit[];
  /** Unit shown while the value is 0. */
  defaultUnit: number;
  label: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const { t } = useT();
  const [unit, setUnit] = useState(() => bestUnit(value, units, defaultUnit));
  const [text, setText] = useState(() => String(value / bestUnit(value, units, defaultUnit)));

  // Follow external changes (load, reset) without fighting the user's typing.
  useEffect(() => {
    const typed = Number(text);
    if (!isFinite(typed) || Math.round(typed * unit) !== value) {
      const u = bestUnit(value, units, defaultUnit);
      setUnit(u);
      setText(String(value / u));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (t: string, u: number) => {
    const n = Number(t);
    if (t.trim() !== "" && isFinite(n) && n >= 0) onChange(Math.round(n * u));
  };

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          emit(e.target.value, unit);
        }}
        className="max-w-[9rem]"
        {...aria}
      />
      <Select
        aria-label={t("common.unitOf", { label })}
        value={unit}
        onChange={(e) => {
          const u = Number(e.target.value);
          setUnit(u);
          emit(text, u);
        }}
        className="max-w-[7rem]"
      >
        {units.map((u) => (
          <option key={u.label} value={u.factor}>
            {u.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
