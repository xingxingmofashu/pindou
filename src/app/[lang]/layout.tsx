import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { I18nProvider } from "@/i18n/client";
import { getDictionary } from "@/i18n/server";
import { isLocale, locales } from "@/i18n/config";
import { SWRProvider } from "@/components/providers/swr-provider";
import { WebVitals } from "@/components/providers/web-vitals";
import { Toaster } from "@/components/ui/toast";
import { SITE_URL } from "@/lib/server/meta";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    metadataBase: new URL(SITE_URL),
    // hreflang for the root route is added per-page (the layout cannot know
    // its own path); pages with content override `title`/`description`/OG.
    openGraph: {
      title: dict.meta.title,
      description: dict.meta.description,
      siteName: "Pindou",
      locale: lang,
      type: "website",
      images: [new URL("/og.png", SITE_URL).toString()],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.title,
      description: dict.meta.description,
      images: [new URL("/og.png", SITE_URL).toString()],
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const messages = await getDictionary(lang);

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-dvh">
        <I18nProvider locale={lang} messages={messages}>
          <SWRProvider>{children}</SWRProvider>
          <WebVitals />
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
