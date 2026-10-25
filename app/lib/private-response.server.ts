/** Account-specific data must bypass both browser and shared caches. */
export const privateHeaders = { "Cache-Control": "private, no-store" };
export const privateJson = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: privateHeaders });
