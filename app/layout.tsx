import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { SolanaProvider } from "@/components/counter/provider/Solana";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable}`}>
      <body>
        <SolanaProvider>{children}</SolanaProvider>
      </body>
    </html>
  );
}
