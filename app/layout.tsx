import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { SolanaProvider } from "@/components/counter/provider/Solana";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

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
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "dark",
        inter.variable,
        jetbrainsMono.variable,
        spaceGrotesk.variable,
        "font-sans"
      )}
      suppressHydrationWarning
    >
      <body>
        <TooltipProvider delayDuration={150}>
          <SolanaProvider>{children}</SolanaProvider>
        </TooltipProvider>
        <Toaster theme="dark" position="bottom-right" richColors />
      </body>
    </html>
  );
}
