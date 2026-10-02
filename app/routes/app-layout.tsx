import { Outlet } from "react-router";
import { requireOfficial } from "~/lib/session.server";
import type { Route } from "./+types/app-layout";

export async function loader({ request }: Route.LoaderArgs) {
  await requireOfficial(request);
  return null;
}

export default function AppLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-24">
      <Outlet />
    </div>
  );
}
