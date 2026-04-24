import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../lib/config.ts";
import { CLOUDFLARE_ACCESS_EMAIL_HEADER, resolveAuthenticatedUserEmail } from "../lib/server/request-identity.ts";

function withConfigOverrides(
  overrides: Partial<Pick<typeof config, "webAuthMode" | "webDevUserEmail">>,
  callback: () => void
) {
  const originalAuthMode = config.webAuthMode;
  const originalDevEmail = config.webDevUserEmail;

  if (overrides.webAuthMode !== undefined) {
    config.webAuthMode = overrides.webAuthMode;
  }

  if (overrides.webDevUserEmail !== undefined) {
    config.webDevUserEmail = overrides.webDevUserEmail;
  }

  try {
    callback();
  } finally {
    config.webAuthMode = originalAuthMode;
    config.webDevUserEmail = originalDevEmail;
  }
}

test("resolveAuthenticatedUserEmail in auto mode prefers the Cloudflare Access header", () => {
  withConfigOverrides({ webAuthMode: "auto", webDevUserEmail: "developer@example.com" }, () => {
    const request = new Request("http://localhost/test", {
      headers: {
        [CLOUDFLARE_ACCESS_EMAIL_HEADER]: "User@Example.com"
      }
    });

    const identity = resolveAuthenticatedUserEmail(request);

    assert.equal(identity.ok, true);
    if (identity.ok) {
      assert.equal(identity.userEmail, "user@example.com");
    }
  });
});

test("resolveAuthenticatedUserEmail in auto mode falls back to WEB_DEV_USER_EMAIL", () => {
  withConfigOverrides({ webAuthMode: "auto", webDevUserEmail: "developer@example.com" }, () => {
    const request = new Request("http://localhost/test");
    const identity = resolveAuthenticatedUserEmail(request);

    assert.equal(identity.ok, true);
    if (identity.ok) {
      assert.equal(identity.userEmail, "developer@example.com");
    }
  });
});

test("resolveAuthenticatedUserEmail in auto mode returns 401 when no identity source is present", () => {
  withConfigOverrides({ webAuthMode: "auto", webDevUserEmail: "" }, () => {
    const request = new Request("http://localhost/test");
    const identity = resolveAuthenticatedUserEmail(request);

    assert.deepEqual(identity, {
      ok: false,
      status: 401,
      error: "Unauthorized: missing authenticated user email."
    });
  });
});

test("resolveAuthenticatedUserEmail in cloudflare mode accepts the Cloudflare Access header", () => {
  withConfigOverrides({ webAuthMode: "cloudflare", webDevUserEmail: "developer@example.com" }, () => {
    const request = new Request("http://localhost/test", {
      headers: {
        [CLOUDFLARE_ACCESS_EMAIL_HEADER]: "User@Example.com"
      }
    });

    const identity = resolveAuthenticatedUserEmail(request);

    assert.equal(identity.ok, true);
    if (identity.ok) {
      assert.equal(identity.userEmail, "user@example.com");
    }
  });
});

test("resolveAuthenticatedUserEmail in cloudflare mode rejects requests without the header", () => {
  withConfigOverrides({ webAuthMode: "cloudflare", webDevUserEmail: "developer@example.com" }, () => {
    const request = new Request("http://localhost/test");
    const identity = resolveAuthenticatedUserEmail(request);

    assert.deepEqual(identity, {
      ok: false,
      status: 401,
      error: "Unauthorized: missing Cloudflare authenticated user email."
    });
  });
});

test("resolveAuthenticatedUserEmail in dev mode accepts WEB_DEV_USER_EMAIL", () => {
  withConfigOverrides({ webAuthMode: "dev", webDevUserEmail: "Developer@Example.com" }, () => {
    const request = new Request("http://localhost/test");
    const identity = resolveAuthenticatedUserEmail(request);

    assert.equal(identity.ok, true);
    if (identity.ok) {
      assert.equal(identity.userEmail, "developer@example.com");
    }
  });
});

test("resolveAuthenticatedUserEmail in dev mode ignores the Cloudflare Access header", () => {
  withConfigOverrides({ webAuthMode: "dev", webDevUserEmail: "developer@example.com" }, () => {
    const request = new Request("http://localhost/test", {
      headers: {
        [CLOUDFLARE_ACCESS_EMAIL_HEADER]: "cloudflare@example.com"
      }
    });

    const identity = resolveAuthenticatedUserEmail(request);

    assert.equal(identity.ok, true);
    if (identity.ok) {
      assert.equal(identity.userEmail, "developer@example.com");
    }
  });
});

test("resolveAuthenticatedUserEmail in dev mode returns a config error when WEB_DEV_USER_EMAIL is missing", () => {
  withConfigOverrides({ webAuthMode: "dev", webDevUserEmail: "" }, () => {
    const request = new Request("http://localhost/test");
    const identity = resolveAuthenticatedUserEmail(request);

    assert.deepEqual(identity, {
      ok: false,
      status: 401,
      error: "Unauthorized: WEB_DEV_USER_EMAIL must be set when WEB_AUTH_MODE=dev."
    });
  });
});

test("invalid auth mode values fall back to auto behavior", () => {
  withConfigOverrides({ webAuthMode: "auto", webDevUserEmail: "" }, () => {
    config.webAuthMode = "invalid" as typeof config.webAuthMode;

    const request = new Request("http://localhost/test", {
      headers: {
        [CLOUDFLARE_ACCESS_EMAIL_HEADER]: "User@Example.com"
      }
    });
    const identity = resolveAuthenticatedUserEmail(request);

    assert.equal(identity.ok, true);
    if (identity.ok) {
      assert.equal(identity.userEmail, "user@example.com");
    }
  });
});
