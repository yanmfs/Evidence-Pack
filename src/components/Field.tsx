import { useId, type InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}

export function Field({ label, value, onChange, multiline, ...rest }: Props) {
  const id = useId();
  const cls = "w-full rounded-control border border-border bg-surface px-3 text-sm";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${cls} resize-none py-2`}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${cls} h-9`}
          {...rest}
        />
      )}
    </div>
  );
}
