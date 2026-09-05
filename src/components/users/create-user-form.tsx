"use client";

import { useActionState } from "react";
import { createUserAction } from "@/app/(protected)/dashboard/users/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, {});
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inviter un utilisateur</CardTitle>
        <CardDescription>
          Un email sécurisé lui permettra de finaliser son compte.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          {state.error || state.success ? (
            <Alert
              variant={state.error ? "destructive" : "default"}
              className="sm:col-span-2"
            >
              <AlertDescription>
                {state.error ?? state.success}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="fullName">Nom complet</Label>
            <Input id="fullName" name="fullName" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="role">Rôle</Label>
            <Select name="role" required>
              <SelectTrigger id="role" className="w-full">
                <SelectValue placeholder="Sélectionner un rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="brand_admin">
                  Administrateur de marque
                </SelectItem>
                <SelectItem value="brand_user">
                  Utilisateur de marque
                </SelectItem>
                <SelectItem value="agent">Agent commercial</SelectItem>
                <SelectItem value="facilitator">
                  Intervenant terrain
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Button disabled={pending}>
              {pending ? "Invitation…" : "Envoyer l’invitation"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
