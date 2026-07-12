import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { exchangeDataGsmCode, fetchDataGsmUser, toEligibleAppUser } from "@/lib/datagsm";
import { authErrorFlash, redirectWithFlash } from "@/lib/flash";
import { setUserSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get("datagsm_oauth_state")?.value;
  const codeVerifier = cookieStore.get("datagsm_code_verifier")?.value;

  cookieStore.delete("datagsm_oauth_state");
  cookieStore.delete("datagsm_code_verifier");

  if (!code || !state || !savedState || !codeVerifier || state !== savedState) {
    return redirectWithFlash(request, "/", authErrorFlash("oauth_state"), 307);
  }

  try {
    const accessToken = await exchangeDataGsmCode({
      code,
      codeVerifier,
      redirectUri: process.env.DATAGSM_REDIRECT_URI ?? `${url.origin}/api/auth/datagsm/callback`
    });
    const dataGsmUser = await fetchDataGsmUser(accessToken);
    const appUser = toEligibleAppUser(dataGsmUser);

    if (!appUser) {
      return redirectWithFlash(request, "/", authErrorFlash("not_eligible"), 307);
    }

    await setUserSession(appUser);
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("DataGSM callback failed", error instanceof Error ? error.name : "unknown_error");
    return redirectWithFlash(request, "/", authErrorFlash("oauth_failed"), 307);
  }
}
