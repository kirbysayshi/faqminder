import type { Route } from "./+types/faq";

// P0 placeholder — replaced by the reader feature in P2.
export default function Faq({ params }: Route.ComponentProps) {
  return (
    <main className="mx-auto max-w-2xl p-4">
      <p className="text-neutral-400">Reader for FAQ: {params.id}</p>
    </main>
  );
}
