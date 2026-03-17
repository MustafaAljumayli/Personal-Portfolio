export const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_CONTACT_API_BASE_URL as string | undefined) ??
  ""
).replace(/\/+$/, "");
