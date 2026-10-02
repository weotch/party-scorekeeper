import { createHash, timingSafeEqual } from "node:crypto";
import { createCookieSessionStorage, redirect } from "react-router";

let storage: ReturnType<typeof createCookieSessionStorage<{ official: true }>> | undefined;

// Created on first use so a missing secret fails loudly instead of signing
// cookies with an empty (forgeable) secret.
function sessionStorage() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing environment variable SESSION_SECRET");
  storage ??= createCookieSessionStorage<{ official: true }>({
    cookie: {
      name: "__session",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
      secrets: [secret],
    },
  });
  return storage;
}

function getSession(request: Request) {
  return sessionStorage().getSession(request.headers.get("Cookie"));
}

export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("Missing environment variable APP_PASSWORD");
  // Compare hashes so the comparison is constant time regardless of length.
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(input), hash(expected));
}

export async function isSignedIn(request: Request): Promise<boolean> {
  return (await getSession(request)).get("official") === true;
}

/** Call at the top of every protected loader and action. */
export async function requireOfficial(request: Request): Promise<void> {
  if (!(await isSignedIn(request))) throw redirect("/login");
}

export async function signIn(request: Request, redirectTo: string): Promise<Response> {
  const session = await getSession(request);
  session.set("official", true);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await sessionStorage().commitSession(session) },
  });
}

export async function signOut(request: Request): Promise<Response> {
  const session = await getSession(request);
  return redirect("/login", {
    headers: { "Set-Cookie": await sessionStorage().destroySession(session) },
  });
}
