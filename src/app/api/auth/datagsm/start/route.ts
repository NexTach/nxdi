import { NextRequest, NextResponse } from "next/server";
import { createAuthorizeUrl, createCodeChallenge } from "@/lib/datagsm";
import { randomToken } from "@/lib/session";

export async function GET(request: NextRequest) {
  const clientId = process.env.DATAGSM_CLIENT_ID;
  const requestUrl = new URL(request.url);
  const redirectUri = process.env.DATAGSM_REDIRECT_URI ?? `${requestUrl.origin}/api/auth/datagsm/callback`;

  if (!clientId || !redirectUri) {
    return NextResponse.redirect(new URL("/?authError=datagsm_not_configured", request.url));
  }

  if (new URL(redirectUri).origin !== requestUrl.origin) {
    return NextResponse.redirect(new URL("/?authError=oauth_origin", request.url));
  }

  const state = randomToken();
  const codeVerifier = randomToken();
  const url = createAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    codeChallenge: createCodeChallenge(codeVerifier)
  });
  const response = NextResponse.redirect(url);
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: requestUrl.protocol === "https:",
    maxAge: 60 * 5,
    path: "/"
  };

  response.cookies.set("datagsm_oauth_state", state, cookieOptions);
  response.cookies.set("datagsm_code_verifier", codeVerifier, cookieOptions);

  return response;
}
