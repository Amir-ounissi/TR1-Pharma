import { Alert, AlertDescription } from "@/components/ui/alert";
import { translateUiMessage } from "@/lib/ui-copy";

export function ActionFeedback({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  const message = translateUiMessage(error ?? success);
  return (
    <Alert variant={error ? "destructive" : "default"}>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
