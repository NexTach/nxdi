"use client";

import Link from "next/link";
import { useState } from "react";
import { ToastStack, type ToastMessage } from "@/app/components/toast";

export function IntentLink({ signedIn }: { signedIn: boolean }) {
  const [message, setMessage] = useState<ToastMessage | null>(null);

  if (signedIn) {
    return (
      <Link className="button" href="/intents">
        의향서 작성
      </Link>
    );
  }

  return (
    <>
      <ToastStack messages={message ? [message] : []} />
      <Link
        className="button"
        href="/?loginRequired=1"
        onClick={(event) => {
          event.preventDefault();
          setMessage({
            id: `login-required-${Date.now()}`,
            title: "로그인이 필요합니다",
            description: "DataGSM으로 로그인한 뒤 의향서를 작성해주세요.",
            tone: "info"
          });
        }}
      >
        의향서 작성
      </Link>
    </>
  );
}
