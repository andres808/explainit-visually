import type { Metadata } from "next";
import "./globals.css";
import BillingTestBanner from "@/components/billing-test-banner";
export const metadata: Metadata = {
  title: "ExplainIt Visually — Follow your curiosity",
  description:
    "Turn complex ideas into interactive visual explanations. Explore every component and understand how everything connects.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body><BillingTestBanner />{children}</body>
    </html>
  );
}
