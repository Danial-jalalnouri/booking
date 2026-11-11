import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bookly - Appointment Booking",
  description: "Let customers book appointments with your business",
};

const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark");}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-grid min-h-screen antialiased">
        <div className="aurora" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
