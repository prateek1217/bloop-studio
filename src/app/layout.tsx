import type { Metadata } from "next";
import {
  Inter,
  Archivo_Black,
  Poppins,
  Baloo_2,
  Russo_One,
  Source_Serif_4,
  Caveat,
  Anton,
  Playfair_Display,
  Luckiest_Guy,
  Gabarito,
} from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const gabarito = Gabarito({ variable: "--font-gabarito", subsets: ["latin"], weight: ["600", "700", "800", "900"] });
const archivoBlack = Archivo_Black({ variable: "--font-archivo-black", subsets: ["latin"], weight: "400" });
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
});
const baloo = Baloo_2({ variable: "--font-baloo", subsets: ["latin"], weight: ["600", "700", "800"] });
const russoOne = Russo_One({ variable: "--font-russo-one", subsets: ["latin"], weight: "400" });
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
});
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["600", "700"] });
const anton = Anton({ variable: "--font-anton", subsets: ["latin"], weight: "400" });
const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});
const luckiestGuy = Luckiest_Guy({ variable: "--font-luckiest-guy", subsets: ["latin"], weight: "400" });

// NEXT_PUBLIC_SITE_URL is the canonical production URL (set it in Vercel's
// env vars once the project has a domain); VERCEL_URL is the fallback Vercel
// always provides on preview/production deploys, and localhost covers dev.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Bloop Studio — AI-aware captions for reels",
  description: "Upload a talking-head video and get subtitles that move around, behind, and in front of the person.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${archivoBlack.variable} ${poppins.variable} ${baloo.variable} ${russoOne.variable} ${sourceSerif.variable} ${caveat.variable} ${anton.variable} ${playfairDisplay.variable} ${luckiestGuy.variable} ${gabarito.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: some browser extensions (form-fillers, etc.)
          inject attributes like jf-observer-attached onto <body> before React
          hydrates. That's an extension modifying the DOM, not a real
          server/client mismatch in our markup, so we tell React to ignore
          attribute diffs on this node specifically. */}
      {/* h-full (not min-h-full): pages like the editor need a firm, real
          height passed down so their flex-1/overflow-hidden panels can
          actually bound and internally scroll instead of growing the whole
          page. A `min-height` only floor never reliably resolves for
          percentage/flex descendants. Normal tall pages (landing)
          still scroll fine — overflow:visible content isn't clipped by this,
          it just extends past body's box as usual. */}
      <body
        className="h-full flex flex-col bg-neutral-950 text-neutral-100"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
