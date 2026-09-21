import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { gateEnabled } from "@/lib/auth";
import { login } from "./actions";

export const metadata = { title: "Sign in · Primo Estimator" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const error = params.error === "1";
  const next = typeof params.next === "string" ? params.next : "/";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Primo Estimator</CardTitle>
          <CardDescription>Internal demo. Enter the demo password to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          {!gateEnabled() ? (
            <p className="text-sm text-muted-foreground">
              No <code>DEMO_PASSWORD</code> is configured, so the gate is open. Set it in your environment to
              require a password.
            </p>
          ) : (
            <form action={login} className="space-y-4">
              <input type="hidden" name="next" value={next} />
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" autoFocus required autoComplete="current-password" />
              </div>
              {error && <p className="text-sm text-destructive">That password is not right.</p>}
              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
