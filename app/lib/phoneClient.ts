export interface PhoneResolution {
  address: string | null;
  configured: boolean;
}

const E164 = /^\+[1-9]\d{6,14}$/;

export function isPhoneNumber(value: string): boolean {
  return E164.test(value.trim());
}

/** Resolve a phone number to a wallet address via the SocialConnect route. */
export async function resolvePhone(phone: string): Promise<PhoneResolution> {
  try {
    const res = await fetch("/api/resolve-phone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: phone.trim() }),
    });
    if (!res.ok) return { address: null, configured: false };
    return (await res.json()) as PhoneResolution;
  } catch {
    return { address: null, configured: false };
  }
}
