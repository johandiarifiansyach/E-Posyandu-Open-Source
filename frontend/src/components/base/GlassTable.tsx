// Copyright (C) 2026 Johandi Arifiansyach

import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react';

/**
 * Ein UI glass-table primitives adapted for the existing native table
 * markup. The registry component normally owns the table element; the
 * viewport primitive below lets legacy data tables keep their specialised
 * rows, virtualization, and always-visible horizontal scrollbar.
 */
function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

const glassTableSurface = [
  'relative w-full overflow-auto rounded-2xl border border-white/35 bg-white/30 backdrop-blur-xl backdrop-saturate-150',
  'shadow-[0_8px_32px_rgba(15,23,42,0.08)]',
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-gradient-to-b before:from-white/30 before:to-transparent before:content-['']",
].join(' ');

export type GlassTableViewportProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

export const GlassTableViewport = forwardRef<HTMLDivElement, GlassTableViewportProps>(function GlassTableViewport(
  { className, children, ...props },
  ref,
) {
  return <div ref={ref} className={cx(glassTableSurface, 'glass-table-viewport', className)} {...props}>{children}</div>;
});

GlassTableViewport.displayName = 'GlassTableViewport';

export const GlassTable = forwardRef<HTMLTableElement, TableHTMLAttributes<HTMLTableElement>>(function GlassTable(
  { className, children, ...props },
  ref,
) {
  return <GlassTableViewport>
    <table ref={ref} className={cx('relative z-10 w-full caption-bottom text-sm', className)} {...props}>{children}</table>
  </GlassTableViewport>;
});

GlassTable.displayName = 'GlassTable';

export const GlassTableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(function GlassTableHeader(
  { className, ...props },
  ref,
) {
  return <thead ref={ref} className={cx('[&_tr]:border-b [&_tr]:border-slate-300/35', className)} {...props} />;
});

GlassTableHeader.displayName = 'GlassTableHeader';

export const GlassTableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(function GlassTableBody(
  { className, ...props },
  ref,
) {
  return <tbody ref={ref} className={cx('[&_tr:last-child]:border-0', className)} {...props} />;
});

GlassTableBody.displayName = 'GlassTableBody';

export const GlassTableFooter = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(function GlassTableFooter(
  { className, ...props },
  ref,
) {
  return <tfoot ref={ref} className={cx('border-t border-slate-300/35 bg-white/20 font-medium', className)} {...props} />;
});

GlassTableFooter.displayName = 'GlassTableFooter';

export const GlassTableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(function GlassTableRow(
  { className, ...props },
  ref,
) {
  return <tr ref={ref} className={cx('border-b border-slate-300/30 transition-colors hover:bg-white/40', className)} {...props} />;
});

GlassTableRow.displayName = 'GlassTableRow';

export const GlassTableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(function GlassTableHead(
  { className, ...props },
  ref,
) {
  return <th ref={ref} className={cx('h-12 px-4 text-left align-middle font-medium text-slate-600', className)} {...props} />;
});

GlassTableHead.displayName = 'GlassTableHead';

export const GlassTableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(function GlassTableCell(
  { className, ...props },
  ref,
) {
  return <td ref={ref} className={cx('p-4 align-middle text-slate-700', className)} {...props} />;
});

GlassTableCell.displayName = 'GlassTableCell';

export const GlassTableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(function GlassTableCaption(
  { className, ...props },
  ref,
) {
  return <caption ref={ref} className={cx('mt-4 text-sm text-slate-500', className)} {...props} />;
});

GlassTableCaption.displayName = 'GlassTableCaption';
