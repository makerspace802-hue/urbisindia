import Google from "@auth/core/providers/google";
import type { AuthProviderConfig } from "@convex-dev/auth/server";

/**
 * Google sign-in.
 *
 * Google OAuth needs a client id and secret, which live in environment
 * variables the developer sets in the dashboard rather than in the repo. When
 * those are absent we deliberately register NO provider rather than a
 * half-configured one: a provider with blank credentials would fail at the
 * moment somebody clicks the button, which is a much worse experience than not
 * offering the button at all.
 *
 * `googleEnabled` is what the client checks before rendering the button, so the
 * UI and the backend can never disagree about whether Google works.
 */
const clientId = process.env.AUTH_GOOGLE_ID;
const clientSecret = process.env.AUTH_GOOGLE_SECRET;

export const googleEnabled = Boolean(clientId && clientSecret);

export const googleProviders: AuthProviderConfig[] = googleEnabled
  ? [
      Google({
        clientId,
        clientSecret,
        allowDangerousEmailAccountLinking: true,
      }),
    ]
  : [];
