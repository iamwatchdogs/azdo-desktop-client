import { createHashHistory, createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  // file:// has no meaningful pathname; the hash keeps routing working when packaged.
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
