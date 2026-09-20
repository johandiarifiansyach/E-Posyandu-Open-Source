// SPDX-License-Identifier: GPL-3.0-or-later


import {
  forwardRef,
  type ChangeEventHandler,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';

export type GlassSelectOption = {
  value: string | number;
  label: string;
};

export type GlassSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'children' | 'value' | 'onChange'
> & {
  value?: string | number;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  options?: readonly GlassSelectOption[];
  children?: ReactNode;
  /** Legacy alias used by the existing filter/form API. */
  ariaLabel?: string;
  wrapperClassName?: string;
  /** Hide the custom chevron when the select is embedded in another control. */
  showChevron?: boolean;
};

function ChevronDown() {
  return (
    <svg
      className="glass-select-chevron"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Native-select version of Ein UI's glass-select surface.
 *
 * Keeping the native element avoids adding Radix as a second select runtime
 * and preserves keyboard/mobile picker behavior across the existing app.
 */
const GlassSelect = forwardRef<HTMLSelectElement, GlassSelectProps>(
  function GlassSelect(
    {
      value,
      onChange,
      options,
      children,
      ariaLabel,
      className = '',
      wrapperClassName = '',
      showChevron = true,
      ...props
    },
    ref,
  ) {
    return (
      <span className={`glass-select-shell group ${wrapperClassName}`.trim()}>
        <select
          ref={ref}
          {...props}
          value={value}
          onChange={onChange}
          aria-label={ariaLabel ?? props['aria-label']}
          className={`glass-select ${className}`.trim()}
        >
          {children ??
            options?.map((option) => (
              <option key={String(option.value)} value={option.value}>
                {option.label}
              </option>
            ))}
        </select>
        {showChevron ? <ChevronDown /> : null}
      </span>
    );
  },
);

GlassSelect.displayName = 'GlassSelect';

export default GlassSelect;
