import { Provider as JotaiProvider } from "jotai";
import { useEffect } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";
import { UpdateBanner } from "~/features/app-update";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "icon.svg", type: "image/svg+xml" },
  { rel: "manifest", href: "manifest.webmanifest" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0a0a0a" />
        <Meta />
        <Links />
      </head>
      <body className="bg-neutral-950 text-neutral-100 antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  // Register the SW (offline shell) client-side in production only.
  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`)
        .catch(() => {});
    }
  }, []);

  return (
    <JotaiProvider>
      <UpdateBanner />
      <Outlet />
    </JotaiProvider>
  );
}
