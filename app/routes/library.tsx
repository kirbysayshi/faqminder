import type { Route } from "./+types/library";
import { LibraryScreen } from "~/features/library";
import { ImportButton } from "~/features/import";

export function meta(_: Route.MetaArgs) {
  return [{ title: "FAQMinder" }];
}

export default function Library() {
  return <LibraryScreen importSlot={<ImportButton />} />;
}
