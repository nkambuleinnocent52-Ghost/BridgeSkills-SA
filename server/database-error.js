// Return fixed descriptions only. Database error messages can contain private connection details.
export function databaseFailure(error) {
  const code = error?.code;
  if (
    [
      "SELF_SIGNED_CERT_IN_CHAIN",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    ].includes(code)
  )
    return {
      code: "DATABASE_TLS_UNTRUSTED",
      error:
        "The database certificate needs its trusted root certificate configured.",
    };
  if (code === "ERR_TLS_CERT_ALTNAME_INVALID")
    return {
      code: "DATABASE_TLS_HOSTNAME_MISMATCH",
      error: "The database hostname does not match its TLS certificate.",
    };
  if (code === "28P01")
    return {
      code: "DATABASE_AUTH_FAILED",
      error: "The database rejected the configured login.",
    };
  if (code === "42P01" || code === "3F000")
    return {
      code: "DATABASE_SCHEMA_MISSING",
      error: "The app database schema has not been created.",
    };
  if (code === "42501")
    return {
      code: "DATABASE_PERMISSION_DENIED",
      error: "The configured database account cannot access the app schema.",
    };
  if (["ENOTFOUND", "EAI_AGAIN"].includes(code))
    return {
      code: "DATABASE_HOST_NOT_FOUND",
      error: "The configured database hostname could not be resolved.",
    };
  if (
    ["ECONNREFUSED", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH"].includes(
      code,
    ) ||
    /connection timeout/i.test(error?.message || "")
  )
    return {
      code: "DATABASE_UNREACHABLE",
      error: "The database could not be reached from the app server.",
    };
  return {
    code: "DATABASE_UNAVAILABLE",
    error: "The app database is temporarily unavailable.",
  };
}
