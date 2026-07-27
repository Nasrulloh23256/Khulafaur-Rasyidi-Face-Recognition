import { useState } from "react";
import type { AppProps } from "next/app";
import Head from "next/head";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import "@/index.css";

const appIcon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%23a633cc'/%3E%3Ctext x='32' y='43' font-family='Arial,sans-serif' font-size='38' font-weight='800' text-anchor='middle' fill='white'%3E%CE%A9%3C/text%3E%3C/svg%3E";

const App = ({ Component, pageProps }: AppProps) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <Head>
        <title>Ohm Study Club Attendance</title>
        <meta name="application-name" content="Ohm Study Club Attendance" />
        <meta name="description" content="Portal absensi Ohm Study Club" />
        <link rel="icon" href={appIcon} />
        <link rel="apple-touch-icon" href={appIcon} />
      </Head>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Component {...pageProps} />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
