"use client";
import { ClerkProvider } from "@clerk/nextjs";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { Inter } from "next/font/google";
import "../../styles/globals.css";
import { useEffect, useState } from "react";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }) {
  const [theme, setTheme] = useState("coastal");

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "coastal" ? "black-gold" : "coastal"));
  };

  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <Navbar />
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === "coastal" ? "🌞" : "🌜"}
          </button>
          {children}
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}
