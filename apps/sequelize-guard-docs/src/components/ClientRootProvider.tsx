"use client";

import { RootProvider } from "fumadocs-ui/provider/next";

export default function ClientRootProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RootProvider>{children}</RootProvider>;
}
