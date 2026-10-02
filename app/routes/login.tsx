import { Form, redirect, useNavigation } from "react-router";
import { checkPassword, isSignedIn, signIn } from "~/lib/session.server";
import type { Route } from "./+types/login";

export const meta: Route.MetaFunction = () => [{ title: "Sign in · Party Scorekeeper" }];

export async function loader({ request }: Route.LoaderArgs) {
  if (await isSignedIn(request)) throw redirect("/");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  if (!checkPassword(password)) return { error: "Wrong password" };
  return signIn(request, "/");
}

export default function Login({ actionData }: Route.ComponentProps) {
  const submitting = useNavigation().state === "submitting";
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-center text-3xl font-bold">Party Scorekeeper</h1>
      <Form method="post" className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            autoFocus
            className="rounded-lg border border-gray-300 px-3 py-3 text-base dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        {actionData?.error && <p className="text-sm text-red-600">{actionData.error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-gray-900 py-3 text-base font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-gray-900"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </Form>
    </main>
  );
}
