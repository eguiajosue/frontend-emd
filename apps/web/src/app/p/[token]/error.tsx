"use client";

import { useEffect } from "react";
import { PublicLinkState } from "@/components/portal/PublicLinkState";
import { reportErrorToSentry } from "@/lib/reportErrorToSentry";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportErrorToSentry(error);
  }, [error]);
  return <PublicLinkState state="error" digest={error.digest} onRetry={reset} />;
}
