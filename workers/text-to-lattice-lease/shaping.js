export const LATTICE_LOCATION_SHAPERS = Object.freeze({
  POST: Object.freeze({
    binding: "LATTICE_ACQUIRE_SHAPER",
    key: "text-to-lattice-lease:acquire",
    code: "location-acquire-minute-limit",
    retryAfterSeconds: 60,
  }),
  DELETE: Object.freeze({
    binding: "LATTICE_RELEASE_SHAPER",
    key: "text-to-lattice-lease:release",
    code: "location-release-minute-limit",
    retryAfterSeconds: 60,
  }),
  PATCH: Object.freeze({
    binding: "LATTICE_RENEWAL_SHAPER",
    key: "text-to-lattice-lease:renew",
    code: "location-renewal-minute-limit",
    retryAfterSeconds: 60,
  }),
});

export const LATTICE_LEASE_LOCATION_SHAPERS = Object.freeze({
  DELETE: Object.freeze({
    binding: "LATTICE_RELEASE_LEASE_SHAPER",
    keyPrefix: "text-to-lattice-lease:lease-release:",
    code: "location-lease-release-minute-limit",
    retryAfterSeconds: 60,
  }),
  PATCH: Object.freeze({
    binding: "LATTICE_RENEWAL_LEASE_SHAPER",
    keyPrefix: "text-to-lattice-lease:lease-renew:",
    code: "location-lease-renewal-minute-limit",
    retryAfterSeconds: 60,
  }),
});

export const LATTICE_PATH_LOCATION_SHAPER = Object.freeze({
  binding: "LATTICE_PATH_SHAPER",
  key: "text-to-lattice-lease:path",
  code: "location-path-minute-limit",
  retryAfterSeconds: 60,
});

export const LATTICE_INGRESS_LOCATION_SHAPER = Object.freeze({
  binding: "LATTICE_INGRESS_SHAPER",
  key: "text-to-lattice-lease:ingress",
  code: "location-ingress-minute-limit",
  retryAfterSeconds: 60,
});

async function applyLocationShaper(policy, env, key) {
  const binding = env?.[policy.binding];
  if (!binding || typeof binding.limit !== "function") {
    throw new Error(`Text to Lattice is missing the ${policy.binding} rate-shaper binding.`);
  }
  const outcome = await binding.limit({ key });
  return Object.freeze({
    success: outcome?.success === true,
    code: policy.code,
    retryAfterSeconds: policy.retryAfterSeconds,
  });
}

export function shapeLatticeIngressRequest(env) {
  return applyLocationShaper(
    LATTICE_INGRESS_LOCATION_SHAPER,
    env,
    LATTICE_INGRESS_LOCATION_SHAPER.key,
  );
}

export async function shapeLatticeUsageRequest(method, env, leaseId) {
  const methodPolicy = LATTICE_LOCATION_SHAPERS[method];
  if (!methodPolicy) throw new TypeError(`Unsupported Text to Lattice usage method: ${method}`);

  const leasePolicy = LATTICE_LEASE_LOCATION_SHAPERS[method];
  if (leasePolicy) {
    if (typeof leaseId !== "string" || !/^[A-Za-z0-9_-]{20,128}$/u.test(leaseId)) {
      throw new TypeError(
        "Text to Lattice lease-control requests require an opaque credential actor key.",
      );
    }
    const leaseOutcome = await applyLocationShaper(
      leasePolicy,
      env,
      `${leasePolicy.keyPrefix}${leaseId}`,
    );
    if (!leaseOutcome.success) return leaseOutcome;
  } else if (leaseId !== undefined && leaseId !== null) {
    throw new TypeError("Text to Lattice acquisition requests cannot include a lease actor key.");
  }

  const methodOutcome = await applyLocationShaper(methodPolicy, env, methodPolicy.key);
  if (!methodOutcome.success) return methodOutcome;
  return applyLocationShaper(
    LATTICE_PATH_LOCATION_SHAPER,
    env,
    LATTICE_PATH_LOCATION_SHAPER.key,
  );
}
