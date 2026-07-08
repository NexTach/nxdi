import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { exchangeDataGsmCode, fetchDataGsmUser, toEligibleAppUser } from "@/lib/datagsm";
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
    return NextResponse.redirect(new URL("/?authError=oauth_state", request.url));
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
      return NextResponse.redirect(new URL("/?authError=not_eligible", request.url));
    }

    await setUserSession(appUser);
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/?authError=oauth_failed", request.url));
  }
}
