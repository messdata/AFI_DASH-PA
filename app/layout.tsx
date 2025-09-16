// app/layout.tsx
import "leaflet/dist/leaflet.css";
import "./globals.css";
import TopNav from "../components/TopNav"; // ⬅️ add

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white antialiased">
        <TopNav />  {/* ⬅️ add */}
        {children}
      </body>
    </html>
  );
}
