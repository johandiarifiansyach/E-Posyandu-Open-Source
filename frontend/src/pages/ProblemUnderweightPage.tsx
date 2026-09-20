// Copyright (C) 2026 Johandi Arifiansyach

import ReactChildrenTablePage, { type ReactChildrenTablePageProps } from '../features/children/ReactChildrenTablePage';

export type ProblemUnderweightPageProps = ReactChildrenTablePageProps;

export default function ProblemUnderweightPage(props: ProblemUnderweightPageProps) {
  return <ReactChildrenTablePage {...props} initialView="problem_underweight" />;
}
