import { type RouteConfig, index, route } from "@react-router/dev/routes";

// Routes are thin entry points that compose features (ADR 0001). No business logic here.
export default [
  index("routes/library.tsx"),
  route("add", "routes/add.tsx"),
  route("faq/:id", "routes/faq.tsx"),
] satisfies RouteConfig;
