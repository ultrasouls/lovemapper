import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "LoveMapper — Map Your Memories",
    template: "%s — LoveMapper",
  },
  description: "Upload geotagged photos and browse your memories on an interactive map. Like Snapchat Memories, but on the web.",
  keywords: ["photo map", "geotagged photos", "memories", "photo journal", "travel map"],
  openGraph: {
    title: "LoveMapper",
    description: "Map your photo memories. Upload geotagged photos, browse on an interactive map, share with the world.",
    type: "website",
    siteName: "LoveMapper",
  },
  twitter: {
    card: "summary_large_image",
    title: "LoveMapper",
    description: "Map your photo memories.",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
