import type { Route } from "./+types/library";

export function meta(_: Route.MetaArgs) {
  return [{ title: "FAQMiner" }];
}

// P0 placeholder — replaced by the library feature (FAQ picker + import) in P1/P2.
export default function Library() {
  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-xl font-semibold">FAQMiner</h1>
      <p className="mt-2 text-neutral-400">Scaffold OK. Library lands in P1/P2.</p>
    </main>
  );
}
