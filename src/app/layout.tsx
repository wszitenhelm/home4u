import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Home4u",
  description: "Publiczny katalog mieszkań na sprzedaż i wynajem",
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({
  children,
}: RootLayoutProps): React.JSX.Element {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
