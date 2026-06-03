import React from "react";

import { AppHeader } from "@/components/layout/AppHeader";

type Props = {
  title: string;
  topPad: number;
  right?: React.ReactNode;
  bottomSpacing?: number;
};

export function ScreenHeader({
  title,
  topPad,
  right,
  bottomSpacing = 8,
}: Props) {
  return (
    <AppHeader
      title={title}
      topPad={topPad}
      right={right}
      bottomSpacing={bottomSpacing}
    />
  );
}
