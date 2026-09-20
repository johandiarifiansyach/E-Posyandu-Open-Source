// Copyright (C) 2026 Johandi Arifiansyach

import type { ReactNode } from 'react';

export type AuthLayoutProps = {
  children: ReactNode;
  footer?: ReactNode;
};

/** Shared unauthenticated shell for the fixed light application theme. */
export default function AuthLayout({ children, footer }: AuthLayoutProps) {
  return <div className="login-shell">
    <div className="login-batik-background" aria-hidden="true" />
    <main className="login-stage"><div className="login-stack">{children}</div></main>
    {footer ? <footer className="login-footer">{footer}</footer> : null}
  </div>;
}
