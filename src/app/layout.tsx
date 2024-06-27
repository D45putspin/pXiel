import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./app.css"
import "bulma/css/bulma.min.css";


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Xian Next.js Starter",
  description: "Xian Next.js Starter",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
