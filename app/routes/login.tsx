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
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-neon-pink">// Officials only</p>
        <h1 className="mt-2 font-display text-3xl font-black uppercase leading-tight tracking-wide text-neon-cyan text-glow">
          Party Scorekeeper
        </h1>
      </div>
      <Form method="post" className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 font-mono text-xs uppercase tracking-widest text-dim">
          Access code
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            autoFocus
            className="clip-corner-sm border border-neon-cyan/50 bg-panel px-3 py-3 font-mono text-base text-neon-cyan outline-none focus:border-neon-cyan focus:shadow-[0_0_14px_rgb(0_240_255/0.35)]"
          />
        </label>
        {actionData?.error && <p className="font-mono text-sm text-neon-red">! {actionData.error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="clip-corner-sm bg-neon-pink py-3 font-display text-sm font-bold uppercase tracking-widest text-void shadow-[0_0_18px_rgb(255_43_214/0.5)] disabled:opacity-60"
        >
          {submitting ? "Connecting…" : "Jack in"}
        </button>
      </Form>
    </main>
  );
}
