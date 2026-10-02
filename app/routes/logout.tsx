import { redirect } from "react-router";
import { signOut } from "~/lib/session.server";
import type { Route } from "./+types/logout";

export async function action({ request }: Route.ActionArgs) {
  return signOut(request);
}

export async function loader() {
  throw redirect("/");
}
