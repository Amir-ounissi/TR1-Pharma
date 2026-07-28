import { Alert, AlertDescription } from "@/components/ui/alert";

export function ActionFeedback({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return <Alert variant={error ? "destructive" : "default"}><AlertDescription>{error ?? success}</AlertDescription></Alert>;
}
