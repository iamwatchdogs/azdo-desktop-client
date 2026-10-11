import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <div id="app-shell" className="bg-canvas text-ink h-full">
      <Outlet />
    </div>
  ),
});
