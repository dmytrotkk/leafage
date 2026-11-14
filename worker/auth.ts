import {
  OAuthError,
  OAuthErrorCode,
  getOAuthProtectedResourceMetadataUrl,
  requireBearerAuth,
  type AuthInfo,
  type OAuthTokenVerifier,
} from "@modelcontextprotocol/server"
import { createRemoteJWKSet, jwtVerify } from "jose"

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function verifier(supabaseUrl: string): OAuthTokenVerifier {
  const keys = (jwks ??= createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)))
  return {
    async verifyAccessToken(token): Promise<AuthInfo> {
      const { payload } = await jwtVerify(token, keys, { issuer: `${supabaseUrl}/auth/v1`, audience: "authenticated" }).catch(() => {
        throw new OAuthError(OAuthErrorCode.InvalidToken, "invalid or expired token")
      })
      if (typeof payload.client_id !== "string") throw new OAuthError(OAuthErrorCode.InvalidToken, "not an OAuth client token")
      return {
        token,
        clientId: payload.client_id,
        scopes: typeof payload.scope === "string" ? payload.scope.split(" ") : [],
        ...(payload.exp !== undefined && { expiresAt: payload.exp }),
      }
    },
  }
}

export function gate(origin: string, supabaseUrl: string): (request: Request) => Promise<AuthInfo | Response> {
  return requireBearerAuth({
    verifier: verifier(supabaseUrl),
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL(`${origin}/mcp`)),
  })
}

export function protectedResourceMetadata(origin: string, supabaseUrl: string): Response {
  return Response.json({
    resource: `${origin}/mcp`,
    authorization_servers: [`${supabaseUrl}/auth/v1`],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid", "email", "profile"],
  })
}
