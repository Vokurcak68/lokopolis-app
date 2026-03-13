const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || "0x4AAAAAACoE4zw8cH197ejBUMhQvK8FXqY";

export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET,
        response: token,
        remoteip: ip,
      }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}
