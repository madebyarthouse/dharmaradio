export const loader = async () => {
  const response = await fetch(
    "https://plausible.io/js/script.tagged-events.pageleave.outbound-links.js",
  );
  const script = await response.text();
  const { status, headers } = response;

  return new Response(script, {
    status,
    headers,
  });
};
