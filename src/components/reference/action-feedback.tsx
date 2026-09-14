"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { translateUiMessage } from "@/lib/ui-copy";

export function ActionFeedback({
  error,
  success,
  orderId,
}: {
  error?: string;
  success?: string;
  orderId?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (success && orderId) {
      router.replace(`/dashboard/orders/${orderId}/confirmation`);
    }
  }, [orderId, router, success]);

  if (!error && !success) return null;
  const message = translateUiMessage(error ?? success);
  return (
    <Alert variant={error ? "destructive" : "default"}>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
