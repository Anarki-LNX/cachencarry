import { useEffect, useState } from "react";
import { Input, Select } from "./Controls";

const UNITS = [
  { label: "seconds", seconds: 1 },
  { label: "minutes", seconds: 60 },
  { label: "hours", seconds: 3600 },
  { label: "days", seconds: 86400 },
];

function bestUnit(seconds: number): number {
  for (let i = UNITS.length - 1; i > 0; i--) {
    if (seconds > 0 && seconds % UNITS[i].seconds === 0) return UNITS[i].seconds;
  }
  return 1;
}

/** Number + unit editor for a duration held in seconds. */
export function DurationInput({
  id,
  value,
  onChange,
  label,
  disabled,
  ...aria
}: {
  id?: string;
  value: number;
  onChange: (seconds: number) => void;
  label: string;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [unit, setUnit] = useState(() => bestUnit(value));
  const [text, setText] = useState(() => String(value / bestUnit(value)));

  // Follow external changes (load, reset) without fighting the user's typing.
  useEffect(() => {
    const typed = Number(text);
    if (!isFinite(typed) || Math.round(typed * unit) !== value) {
      const u = bestUnit(value);
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
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          emit(e.target.value, unit);
        }}
        className="num !w-28"
        aria-label={id ? undefined : label}
        {...aria}
      />
      <Select
        value={unit}
        disabled={disabled}
        aria-label={`${label} unit`}
        onChange={(e) => {
          const u = Number(e.target.value);
          setUnit(u);
          emit(text, u);
        }}
        className="!w-32"
      >
        {UNITS.map((u) => (
          <option key={u.seconds} value={u.seconds}>
            {u.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
