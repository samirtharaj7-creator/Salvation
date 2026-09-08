import { GlobalShell, GlobalFooter } from "./global-shell";
import "./global-shell.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Salvation | Ask a Question",
  description: "Salvation Research Library",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
        />
      </head>
      <body className="mbe-shell-managed"><GlobalShell />{children}<GlobalFooter /></body>
    </html>
  );
}
