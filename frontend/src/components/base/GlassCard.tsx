// Copyright (C) 2026 Johandi Arifiansyach

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

/**
 * Local copy of Ein UI's GlassCard registry primitive.
 *
 * Ein UI distributes this component through the shadcn registry rather than
 * as a runtime package. Keeping the primitive local lets the Vite app use the
 * same surface while retaining its existing Tailwind 3 build and status
 * colour tokens.
 */
export type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  glowEffect?: boolean;
  wrapperClassName?: string;
  children: ReactNode;
};

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { className, wrapperClassName, glowEffect = true, children, ...props },
  ref
) {
  return <div className={cx('relative', wrapperClassName)}>
    {glowEffect ? <div
      className="pointer-events-none absolute -inset-1 rounded-[inherit] bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 opacity-60 blur-xl"
      aria-hidden="true"
    /> : null}
    <div
      ref={ref}
      className={cx(
        'relative rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl',
        'shadow-[0_8px_32px_rgba(0,0,0,0.12)]',
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-gradient-to-b before:from-white/20 before:to-transparent before:content-['']",
        "after:pointer-events-none after:absolute after:inset-px after:rounded-[calc(1rem-1px)] after:shadow-[inset_0_1px_1px_rgba(255,255,255,0.22)] after:content-['']",
        className
      )}
      {...props}
    >
      <div className="glass-card-content relative z-10">{children}</div>
    </div>
  </div>;
});

GlassCard.displayName = 'GlassCard';

export const GlassCardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function GlassCardHeader(
  { className, ...props },
  ref
) {
  return <div ref={ref} className={cx('flex flex-col gap-1.5 p-6', className)} {...props} />;
});

GlassCardHeader.displayName = 'GlassCardHeader';

export const GlassCardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(function GlassCardTitle(
  { className, ...props },
  ref
) {
  return <h3 ref={ref} className={cx('text-xl font-semibold leading-none tracking-tight', className)} {...props} />;
});

GlassCardTitle.displayName = 'GlassCardTitle';

export const GlassCardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(function GlassCardDescription(
  { className, ...props },
  ref
) {
  return <p ref={ref} className={cx('text-sm text-slate-500', className)} {...props} />;
});

GlassCardDescription.displayName = 'GlassCardDescription';

export const GlassCardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function GlassCardContent(
  { className, ...props },
  ref
) {
  return <div ref={ref} className={cx('p-6 pt-0', className)} {...props} />;
});

GlassCardContent.displayName = 'GlassCardContent';

export const GlassCardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function GlassCardFooter(
  { className, ...props },
  ref
) {
  return <div ref={ref} className={cx('flex items-center p-6 pt-0', className)} {...props} />;
});

GlassCardFooter.displayName = 'GlassCardFooter';
