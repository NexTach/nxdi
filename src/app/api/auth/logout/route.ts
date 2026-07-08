import { NextResponse } from "next/server";
import { clearUserSession } from "@/lib/session";

export async function POST(request: Request) {
  await clearUserSession();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
