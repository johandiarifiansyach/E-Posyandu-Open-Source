// SPDX-License-Identifier: GPL-3.0-or-later


import ReactChildrenTablePage, { type ReactChildrenTablePageProps } from '../features/children/ReactChildrenTablePage';

export type ProblemUnderweightPageProps = ReactChildrenTablePageProps;

export default function ProblemUnderweightPage(props: ProblemUnderweightPageProps) {
  return <ReactChildrenTablePage {...props} initialView="problem_underweight" />;
}
