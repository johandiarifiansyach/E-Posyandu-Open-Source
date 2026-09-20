// Copyright (C) 2026 Johandi Arifiansyach

import ReactChildrenTablePage, { type ReactChildrenTablePageProps } from '../features/children/ReactChildrenTablePage';

export type ProblemWastingPageProps = ReactChildrenTablePageProps;

export default function ProblemWastingPage(props: ProblemWastingPageProps) {
  return <ReactChildrenTablePage {...props} initialView="problem_wasting" />;
}
