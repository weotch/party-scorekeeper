import type { ShouldRevalidateFunctionArgs } from "react-router";

/**
 * For routes whose loader data doesn't depend on the query string: skip the
 * reload when a navigation only changes `?search`, so switching tabs is instant.
 * Form submissions and the periodic refresh still revalidate as usual.
 */
export function skipOnSearchOnlyChange({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  const onlySearchChanged =
    !formMethod && currentUrl.pathname === nextUrl.pathname && currentUrl.search !== nextUrl.search;
  return onlySearchChanged ? false : defaultShouldRevalidate;
}
