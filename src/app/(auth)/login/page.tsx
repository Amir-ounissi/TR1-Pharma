import { Activity } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Activity className="size-5" aria-hidden="true" />
        </div>
        <div><CardTitle className="text-2xl">TR1 Pharma</CardTitle><CardDescription>Accédez à votre espace commercial sécurisé.</CardDescription></div>
      </CardHeader>
      <CardContent><LoginForm /></CardContent>
    </Card>
  );
}
