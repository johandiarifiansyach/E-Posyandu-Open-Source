// Copyright (C) 2026 Johandi Arifiansyach

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

export type GlassInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Adds a restrained Ein UI-style glow around the control while focused. */
  glowOnFocus?: boolean;
  /** Classes applied to the shell, useful when the field sits in a custom grid. */
  wrapperClassName?: string;
  /** Optional content rendered inside the shell (for example a unit suffix). */
  endAdornment?: ReactNode;
};

/**
 * Light-mode adaptation of Ein UI's glass-input primitive.
 *
 * The input remains a native control so every existing form handler,
 * validation attribute, and browser affordance keeps working.
 */
const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  function GlassInput(
    {
      className = '',
      wrapperClassName = '',
      glowOnFocus = true,
      endAdornment,
      ...props
    },
    ref,
  ) {
    return (
      <span className={`glass-input-shell group ${wrapperClassName}`.trim()}>
        {glowOnFocus ? (
          <span className="glass-input-glow" aria-hidden="true" />
        ) : null}
        <input
          ref={ref}
          {...props}
          className={`glass-input ${endAdornment ? 'pr-11' : ''} ${className}`.trim()}
        />
        {endAdornment ? (
          <span className="glass-input-adornment">{endAdornment}</span>
        ) : null}
      </span>
    );
  },
);

GlassInput.displayName = 'GlassInput';

export default GlassInput;
