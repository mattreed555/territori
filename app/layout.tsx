import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Territori",
  description: "A game of territory and captures. Play against local AI or watch two strategies compete.",
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
