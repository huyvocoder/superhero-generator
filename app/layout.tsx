import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hero Studio",
  description: "Biến thân thành siêu anh hùng bằng AI",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        {children}
        {/* richColors: tự tô màu đỏ/xanh theo loại toast; position góc trên phải cho dễ thấy trên mobile lẫn desktop */}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
