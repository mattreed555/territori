import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Territori",
  description: "A simple game of territory. Play against Jev or watch two strategies compete.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
