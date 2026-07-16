import { Link, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/faq";
import { getFaqMeta, getFaqText } from "~/domains/library";
import { getReaderState } from "~/domains/reader";
import { ReaderScreen } from "~/features/reader";

// SPA (ssr:false): the loader runs on the client and reads IndexedDB directly.
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const [meta, text, anchor] = await Promise.all([
    getFaqMeta(params.id),
    getFaqText(params.id),
    getReaderState(params.id),
  ]);
  if (!meta || text === undefined) {
    throw new Response("FAQ not found", { status: 404 });
  }
  return { meta, text, anchor: anchor ?? null };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.meta.title} — FAQMiner` : "FAQMiner" }];
}

export default function Faq({ loaderData }: Route.ComponentProps) {
  // key by id so switching FAQs remounts the reader (fresh scroll + restore).
  return (
    <ReaderScreen
      key={loaderData.meta.id}
      meta={loaderData.meta}
      text={loaderData.text}
      initialAnchor={loaderData.anchor}
    />
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="mx-auto max-w-2xl p-6 text-center">
      <p className="text-neutral-300">{notFound ? "FAQ not found." : "Something went wrong."}</p>
      <Link to="/" className="mt-4 inline-block text-neutral-400 underline">
        Back to library
      </Link>
    </main>
  );
}
