import { Client } from "ldapts";

/**
 * LDAP (Active Directory) client for user authentication. A service account
 * binds first to search for the user's DN by email/UPN, then a second bind
 * with that DN + the user's own password validates their credentials.
 *
 * Note: binding with the service account's full DN fails on this AD (error
 * 52e); the UPN form (user@domain) works and is what we use here.
 */

export class LdapUnavailableError extends Error {
  constructor(cause: unknown) {
    super("No se pudo contactar con el servicio de autenticación LDAP.");
    this.name = "LdapUnavailableError";
    this.cause = cause;
  }
}

type LdapConfig = {
  url: string;
  serviceAccountUpn: string;
  serviceAccountPassword: string;
  baseSearchGroup: string;
};

function getLdapConfig(): LdapConfig {
  const url = process.env.INTEGRATION_LDAP_URL;
  const serviceAccountUpn = process.env.INTEGRATION_LDAP_ACCESSACCOUNT_UPN;
  const serviceAccountPassword = process.env.INTEGRATION_LDAP_ACCESSACCOUNT_PWD;
  const baseSearchGroup = process.env.INTEGRATION_LDAP_USER_BASESEARCHGROUP;

  if (!url || !serviceAccountUpn || !serviceAccountPassword || !baseSearchGroup) {
    throw new Error(
      "INTEGRATION_LDAP_URL, INTEGRATION_LDAP_ACCESSACCOUNT_UPN, INTEGRATION_LDAP_ACCESSACCOUNT_PWD and " +
        "INTEGRATION_LDAP_USER_BASESEARCHGROUP are required to authenticate against LDAP.",
    );
  }

  return { url, serviceAccountUpn, serviceAccountPassword, baseSearchGroup };
}

function createClient(url: string) {
  return new Client({ url, connectTimeout: 8000, timeout: 8000 });
}

/**
 * Finds a user's distinguished name (DN) in Active Directory by email/UPN,
 * using the service account to bind and search.
 */
export async function findLdapUserDn(email: string): Promise<string | null> {
  const config = getLdapConfig();
  const client = createClient(config.url);

  try {
    await client.bind(config.serviceAccountUpn, config.serviceAccountPassword);

    const { searchEntries } = await client.search(config.baseSearchGroup, {
      scope: "sub",
      filter: `(|(mail=${email})(userPrincipalName=${email}))`,
      attributes: ["distinguishedName"],
    });

    const entry = searchEntries[0];

    return entry ? String(entry.dn) : null;
  } catch (error) {
    throw new LdapUnavailableError(error);
  } finally {
    await client.unbind().catch(() => undefined);
  }
}

/**
 * Verifies a user's password by binding directly with their DN. Returns
 * `false` on invalid credentials and throws `LdapUnavailableError` if the
 * LDAP server cannot be reached.
 */
export async function verifyLdapCredentials(dn: string, password: string): Promise<boolean> {
  const config = getLdapConfig();
  const client = createClient(config.url);

  try {
    await client.bind(dn, password);
    return true;
  } catch (error) {
    if (isInvalidCredentialsError(error)) {
      return false;
    }

    throw new LdapUnavailableError(error);
  } finally {
    await client.unbind().catch(() => undefined);
  }
}

function isInvalidCredentialsError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  // AD returns data 52e (invalid credentials) or 775 (account locked) inside
  // the bind error message for authentication failures, as opposed to
  // connection/timeout errors.
  return /data 52e|data 775|InvalidCredentialsError/i.test(message);
}
