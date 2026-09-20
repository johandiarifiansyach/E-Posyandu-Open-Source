// Copyright (C) 2026 Johandi Arifiansyach

import ReactChildrenTablePage, { type ReactChildrenTablePageProps } from '../features/children/ReactChildrenTablePage';

export type RecycleBinPageProps = ReactChildrenTablePageProps;

export default function RecycleBinPage(props: RecycleBinPageProps) {
  return <ReactChildrenTablePage {...props} initialView="recycle" />;
}
