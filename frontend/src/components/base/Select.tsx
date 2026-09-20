// Copyright (C) 2026 Johandi Arifiansyach

import GlassSelect, {
  type GlassSelectOption,
  type GlassSelectProps,
} from './GlassSelect';

export type SelectOption = GlassSelectOption;
export type AppSelectProps = GlassSelectProps & {
  value: string | number;
  onChange: NonNullable<GlassSelectProps['onChange']>;
  options: readonly SelectOption[];
};

/** Backwards-compatible app alias backed by the reusable Ein UI glass select. */
export default function AppSelect(props: AppSelectProps) {
  return <GlassSelect {...props} />;
}
