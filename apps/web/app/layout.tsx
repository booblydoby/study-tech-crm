import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Study Tech — учебный центр в Ташкенте",
  description: "Study Tech — учебный центр: математика и английский, группы и индивидуальные занятия."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
