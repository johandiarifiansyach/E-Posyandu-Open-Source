// SPDX-License-Identifier: GPL-3.0-or-later


import { forwardRef, memo, type ReactNode } from 'react';
import { GlassTableViewport } from './GlassTable';

export type DataTableProps = {
  children?: ReactNode;
  className?: string;
  ariaLabel?: string;
};

const DataTable = memo(
  forwardRef<HTMLDivElement, DataTableProps>(function DataTable(
    { children, className = '', ariaLabel = 'Tabel data' },
    ref,
  ) {
    return <GlassTableViewport
      ref={ref}
      className={`ios-table-scroll ${className}`.trim()}
      role="region"
      tabIndex={0}
      aria-label={ariaLabel}
    >{children}</GlassTableViewport>;
  }),
);

export default DataTable;
