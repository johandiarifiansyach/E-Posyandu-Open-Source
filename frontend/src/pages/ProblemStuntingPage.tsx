// Copyright (C) 2026 Johandi Arifiansyach

import ReactChildrenTablePage, { type ReactChildrenTablePageProps } from '../features/children/ReactChildrenTablePage';

export type ProblemStuntingPageProps = ReactChildrenTablePageProps;

export default function ProblemStuntingPage(props: ProblemStuntingPageProps) {
  return <ReactChildrenTablePage {...props} initialView="problem_stunting" />;
}
