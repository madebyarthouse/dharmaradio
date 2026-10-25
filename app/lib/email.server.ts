/** Structured Email Sending API (Cloudflare Email Service, not Email Routing). */
export type EmailBinding = {
  send(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
};

export async function sendSignInCode(
  env: { EMAIL?: EmailBinding },
  email: string,
  otp: string,
) {
  const text = `Your Dharma Radio sign-in code is ${otp}.\n\nEnter this code in Dharma Radio within 10 minutes. If you didn't request it, you can ignore this email.`;
  const html = `<div style="font-family:system-ui,sans-serif;color:#25352e;max-width:440px;margin:40px auto;line-height:1.6"><p>Dharma Radio</p><h1 style="font-size:24px;font-weight:500">Your sign-in code</h1><p style="font-size:32px;letter-spacing:6px">${otp}</p><p>Enter this code in Dharma Radio within 10 minutes.</p><p>If you didn't request it, you can ignore this email.</p></div>`;
  if (import.meta.env.DEV) {
    // Local Email Sending simulators vary by Wrangler version; never send real mail in dev.
    console.info(`[auth:development] ${email}: ${otp}`);
    return;
  }
  if (!env.EMAIL || !process.env.EMAIL_FROM)
    throw new Error(
      "Configure EMAIL binding and EMAIL_FROM before enabling email sign-in",
    );
  await env.EMAIL.send({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Your Dharma Radio sign-in code",
    text,
    html,
  });
}
