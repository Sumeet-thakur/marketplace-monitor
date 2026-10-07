import { credentialRepo } from "./repositories";
import { encryptSecret, decryptSecret, maskSecret, last4 } from "./crypto";

// Server-only. This is the single choke point for reading/writing marketplace
// credentials. API routes and React code must never import `crypto.ts`
// directly — they go through here, and this module never returns plaintext
// to a caller outside the server-side provider adapters.

export interface CredentialInput {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
}

export interface MaskedCredential {
  apiKeyMasked: string | null;
  apiSecretMasked: string | null;
  accessTokenMasked: string | null;
  configured: boolean;
}

export interface ResolvedCredential {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
}

/** Create or replace the credential for an integration. Only encrypted values are persisted. */
export async function saveCredential(integrationId: string, input: CredentialInput) {
  const data: Record<string, string | null> = {};

  if (input.apiKey !== undefined) {
    data.apiKeyEnc = input.apiKey ? encryptSecret(input.apiKey) : null;
    data.apiKeyLast4 = input.apiKey ? last4(input.apiKey) : null;
  }
  if (input.apiSecret !== undefined) {
    data.apiSecretEnc = input.apiSecret ? encryptSecret(input.apiSecret) : null;
    data.apiSecretLast4 = input.apiSecret ? last4(input.apiSecret) : null;
  }
  if (input.accessToken !== undefined) {
    data.accessTokenEnc = input.accessToken ? encryptSecret(input.accessToken) : null;
    data.accessTokenLast4 = input.accessToken ? last4(input.accessToken) : null;
  }

  credentialRepo.upsert(integrationId, data);
}

export async function deleteCredential(integrationId: string) {
  credentialRepo.deleteByIntegrationId(integrationId);
}

/** Returns only masked values + whether a credential exists. Safe to send to the frontend. */
export async function getMaskedCredential(integrationId: string): Promise<MaskedCredential> {
  const cred = credentialRepo.findByIntegrationId(integrationId);
  if (!cred) {
    return { apiKeyMasked: null, apiSecretMasked: null, accessTokenMasked: null, configured: false };
  }
  return {
    apiKeyMasked: maskSecret(cred.apiKeyLast4),
    apiSecretMasked: maskSecret(cred.apiSecretLast4),
    accessTokenMasked: maskSecret(cred.accessTokenLast4),
    configured: Boolean(cred.apiKeyEnc || cred.apiSecretEnc || cred.accessTokenEnc),
  };
}

/**
 * Returns DECRYPTED credentials. This must only ever be called from
 * server-side provider adapters at the moment a request to the external API
 * is being made — never pass the result of this function into a Next.js API
 * response, a log line, or a React prop.
 */
export async function getResolvedCredential(integrationId: string): Promise<ResolvedCredential> {
  const cred = credentialRepo.findByIntegrationId(integrationId);
  if (!cred) return {};
  return {
    apiKey: cred.apiKeyEnc ? decryptSecret(cred.apiKeyEnc) : undefined,
    apiSecret: cred.apiSecretEnc ? decryptSecret(cred.apiSecretEnc) : undefined,
    accessToken: cred.accessTokenEnc ? decryptSecret(cred.accessTokenEnc) : undefined,
  };
}
