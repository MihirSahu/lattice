import { config } from "../config.ts";

export const CLOUDFLARE_ACCESS_EMAIL_HEADER = "cf-access-authenticated-user-email";

type IdentitySuccess = {
  ok: true;
  userEmail: string;
};

type IdentityFailure = {
  ok: false;
  status: 401;
  error: string;
};

export type RequestIdentityResult = IdentitySuccess | IdentityFailure;

const MISSING_AUTHENTICATED_EMAIL_ERROR = "Unauthorized: missing authenticated user email.";
const MISSING_CLOUDFLARE_EMAIL_ERROR = "Unauthorized: missing Cloudflare authenticated user email.";
const MISSING_DEV_EMAIL_CONFIG_ERROR = "Unauthorized: WEB_DEV_USER_EMAIL must be set when WEB_AUTH_MODE=dev.";

function normalizeEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function resolveAuthenticatedUserEmail(request: Request): RequestIdentityResult {
  const headerEmail = normalizeEmail(request.headers.get(CLOUDFLARE_ACCESS_EMAIL_HEADER));
  const devEmail = normalizeEmail(config.webDevUserEmail);

  switch (config.webAuthMode) {
    case "cloudflare":
      if (headerEmail) {
        return {
          ok: true,
          userEmail: headerEmail
        };
      }

      return {
        ok: false,
        status: 401,
        error: MISSING_CLOUDFLARE_EMAIL_ERROR
      };

    case "dev":
      if (devEmail) {
        return {
          ok: true,
          userEmail: devEmail
        };
      }

      return {
        ok: false,
        status: 401,
        error: MISSING_DEV_EMAIL_CONFIG_ERROR
      };

    case "auto":
    default:
      if (headerEmail) {
        return {
          ok: true,
          userEmail: headerEmail
        };
      }

      if (devEmail) {
        return {
          ok: true,
          userEmail: devEmail
        };
      }

      return {
        ok: false,
        status: 401,
        error: MISSING_AUTHENTICATED_EMAIL_ERROR
      };
  }
}
