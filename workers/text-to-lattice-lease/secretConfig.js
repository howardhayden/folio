import {
  CLOUDFLARE_DEMONSTRATION_SECRET_KEY,
  CLOUDFLARE_DEMONSTRATION_SITE_KEY,
} from "./demonstrationProfile.js";

const MINIMUM_SECRET_CHARACTERS = 32;

export function requiredSigningSecrets(env) {
  const visitorCookieSecret = env?.VISITOR_COOKIE_SECRET;
  const leaseCredentialSecret = env?.LEASE_CREDENTIAL_SECRET;
  const turnstileSecretKey = env?.TURNSTILE_SECRET_KEY;
  const turnstileSiteKey = env?.TURNSTILE_SITE_KEY;
  const usesDemonstrationSecret = turnstileSecretKey === CLOUDFLARE_DEMONSTRATION_SECRET_KEY;
  const usesDemonstrationSiteKey = turnstileSiteKey === CLOUDFLARE_DEMONSTRATION_SITE_KEY;
  if (
    typeof visitorCookieSecret !== "string"
    || visitorCookieSecret.length < MINIMUM_SECRET_CHARACTERS
    || typeof leaseCredentialSecret !== "string"
    || leaseCredentialSecret.length < MINIMUM_SECRET_CHARACTERS
    || visitorCookieSecret === leaseCredentialSecret
    || typeof turnstileSecretKey !== "string"
    || turnstileSecretKey.length < MINIMUM_SECRET_CHARACTERS
    || turnstileSecretKey === visitorCookieSecret
    || turnstileSecretKey === leaseCredentialSecret
    || typeof turnstileSiteKey !== "string"
    || !/^[A-Za-z0-9_-]{1,128}$/u.test(turnstileSiteKey)
    || turnstileSiteKey === visitorCookieSecret
    || turnstileSiteKey === leaseCredentialSecret
    || turnstileSiteKey === turnstileSecretKey
    || usesDemonstrationSecret !== usesDemonstrationSiteKey
  ) {
    throw new Error("Independent Worker secrets and attestation configuration are not configured.");
  }
  return Object.freeze({ visitorCookieSecret, leaseCredentialSecret, turnstileSecretKey, turnstileSiteKey });
}
