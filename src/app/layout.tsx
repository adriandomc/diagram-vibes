import type { Metadata } from 'next';
import '@/styles/globals.scss';

export const metadata: Metadata = {
  title: 'Diagram Vibes - Create Beautiful Diagrams',
  description: 'A simple app for diagram generation with drag-and-drop, pan, zoom, and grid snapping.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
