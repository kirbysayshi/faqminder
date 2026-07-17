import type { Route } from "./+types/add";
import { AddFaqScreen } from "~/features/import";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Add FAQ — FAQMinder" }];
}

export default function Add() {
  return <AddFaqScreen />;
}
