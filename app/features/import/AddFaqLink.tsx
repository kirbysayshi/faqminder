import { Link } from "react-router";

// Header entry point. Replaces the old inline file-picker button: adding a FAQ is now
// a view (paste / bookmarklet / file), so this just routes to it.
export function AddFaqLink({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/add"
      className={`inline-flex cursor-pointer items-center justify-center rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 active:bg-neutral-300 ${className}`}
    >
      Add FAQ
    </Link>
  );
}
