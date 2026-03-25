import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'USB Transfer',
  description: 'Transfer files from Android via USB',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
