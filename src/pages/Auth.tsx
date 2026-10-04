import { AuthSkeleton } from "@/components/RouteSkeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

type Step =
  | { kind: "choose" }
  | { kind: "password"; mode: "signIn" | "signUp"; email: string }
  | { kind: "email" }
  | { kind: "otp"; email: string }
  | { kind: "verified"; email: string };

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [step, setStep] = useState<Step>({ kind: "choose" });
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const markPasswordSet = useMutation(api.identity.markPasswordSet);
  const bootstrapFirstAdmin = useMutation(api.identity.bootstrapFirstAdmin);
  const syncProfile = useMutation(api.profile.syncProfileAcrossProviders);

  // Once somebody is verified we hold them on the "finish setting up" screen
  // instead of bouncing them to the app, so `verified` suppresses the
  // auto-redirect below.
  const verified = step.kind === "verified";

  useEffect(() => {
    if (!authLoading && isAuthenticated && !verified) {
      // Pull profile details across from a sibling row created by a different
      // sign-in provider, so a new provider never looks like a new person.
      void syncProfile().catch(() => undefined);
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect, verified, syncProfile]);

  /** Sign in with an existing password. */
  const handlePasswordSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step.kind !== "password") return;
    setIsLoading(true);
    setError(null);
    try {
      await signIn("password", {
        flow: "signIn",
        email: step.email,
        password,
      });
      navigate(redirect);
    } catch (err) {
      setError(
        err instanceof Error
          ? "That email and password combination did not match. Try again, or use an emailed code instead."
          : "Could not sign in with that password.",
      );
      setPassword("");
    } finally {
      setIsLoading(false);
    }
  };

  /** Create a brand new account with a password. */
  const handlePasswordSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step.kind !== "password") return;
    setIsLoading(true);
    setError(null);
    try {
      await signIn("password", {
        flow: "signUp",
        email: step.email,
        password,
      });
      await markPasswordSet();
      navigate(redirect);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create an account with that password.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  /** Ask Convex to email a one-time code. */
  const handleSendOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;
    setIsLoading(true);
    setError(null);
    try {
      await signIn("email-otp", { email });
      setStep({ kind: "otp", email });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not send a code to that address.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  /** Verify the emailed code, then offer to attach a password. */
  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step.kind !== "otp") return;
    setIsLoading(true);
    setError(null);
    try {
      await signIn("email-otp", { email: step.email, code: otp });
      setOtp("");
      setStep({ kind: "verified", email: step.email });
    } catch {
      setError("That code is not right. Check the email and try again.");
      setOtp("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("google");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Google sign-in did not start.",
      );
      setIsLoading(false);
    }
  };

  /**
   * Attach a password to the account that was just verified over email. This
   * is the step that makes every future sign-in an ordinary password sign-in
   * instead of another emailed code.
   */
  const handleAttachPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signIn("password", {
        flow: "signUp",
        email: step.kind === "verified" ? step.email : "",
        password,
      });
      await markPasswordSet();
      setPassword("");
      navigate(redirect);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not set that password.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Recover admin rights. Only succeeds while no admin has ever been granted,
   * so this cannot be used to hand admin to whoever signs up next. Existing
   * admins (holding `role: "admin"` on their row) can also use it to lock in
   * an email-keyed grant.
   */
  const handleClaimAdmin = async () => {
    setIsLoading(true);
    setError(null);
    setInfo(null);
    try {
      await bootstrapFirstAdmin();
      setInfo("Admin rights are now tied to your email. They will follow you to every device and sign-in method.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not claim admin rights.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--nb-bg)] px-4 py-8">
      <Card className="w-full max-w-md rounded-none border-2 border-[var(--nb-ink)] shadow-[6px_6px_0_0_var(--nb-ink)]">
        {step.kind === "choose" && (
          <>
            <CardHeader className="text-center">
              <div className="flex justify-center">
                <img
                  src={logo}
                  alt="URBIS India"
                  width={60}
                  height={60}
                  className="mb-3 cursor-pointer"
                  onClick={() => navigate("/")}
                />
              </div>
              <CardTitle className="text-xl font-black uppercase tracking-tight text-[var(--nb-text)]">
                Sign in to URBIS India
              </CardTitle>
              <CardDescription className="text-[var(--nb-text-muted)]">
                Use Google, or your email address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <GoogleButton onClick={handleGoogle} disabled={isLoading} />
              <div className="flex items-center gap-3">
                <span className="h-0.5 flex-1 bg-[var(--nb-ink)] opacity-30" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-dim)]">
                  or use email
                </span>
                <span className="h-0.5 flex-1 bg-[var(--nb-ink)] opacity-30" />
              </div>
              <NbButton
                onClick={() => setStep({ kind: "password", mode: "signIn", email: "" })}
                disabled={isLoading}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Sign in with a password
              </NbButton>
              <NbButton
                variant="alt"
                onClick={() => {
                  setError(null);
                  setStep({ kind: "email" });
                }}
                disabled={isLoading}
              >
                <Mail className="mr-2 h-4 w-4" />
                Email me a one-time code
              </NbButton>
              {error && <ErrorText>{error}</ErrorText>}
            </CardContent>
          </>
        )}

        {step.kind === "password" && (
          <form
            onSubmit={
              step.mode === "signIn"
                ? handlePasswordSignIn
                : handlePasswordSignUp
            }
          >
            <CardHeader className="text-center">
              <CardTitle className="text-lg font-black uppercase text-[var(--nb-text)]">
                {step.mode === "signIn" ? "Welcome back" : "Create your account"}
              </CardTitle>
              <CardDescription className="text-[var(--nb-text-muted)]">
                {step.mode === "signIn"
                  ? "Sign in from any device, no emailed code needed"
                  : "Pick a password so you never wait on an inbox again"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                name="email"
                type="email"
                placeholder="name@example.com"
                className="nb-field"
                defaultValue={step.email}
                disabled={isLoading}
                required
                onChange={(e) =>
                  setStep({ ...step, email: e.target.value })
                }
              />
              <Input
                name="password"
                type="password"
                placeholder="At least 8 characters, with a number"
                className="nb-field"
                value={password}
                disabled={isLoading}
                minLength={8}
                required
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <ErrorText>{error}</ErrorText>}
              <p className="text-xs text-[var(--nb-text-dim)]">
                {step.mode === "signIn" ? "No password yet? " : "Already have an account? "}
                <button
                  type="button"
                  className="font-black underline"
                  onClick={() => {
                    setPassword("");
                    setError(null);
                    setStep({
                      kind: "password",
                      mode: step.mode === "signIn" ? "signUp" : "signIn",
                      email: step.email,
                    });
                  }}
                >
                  {step.mode === "signIn" ? "Create one" : "Sign in instead"}
                </button>
              </p>
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <NbButton type="submit" disabled={isLoading} loading={isLoading}>
                {step.mode === "signIn" ? "Sign in" : "Create account"}
              </NbButton>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-[var(--nb-text-muted)]"
                onClick={() => {
                  setPassword("");
                  setError(null);
                  setStep({ kind: "choose" });
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </CardFooter>
          </form>
        )}

        {step.kind === "email" && (
          <form onSubmit={handleSendOtp}>
            <CardHeader className="text-center">
              <CardTitle className="text-lg font-black uppercase text-[var(--nb-text)]">
                Email me a code
              </CardTitle>
              <CardDescription className="text-[var(--nb-text-muted)]">
                Works for a first sign-up and for password resets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                name="email"
                type="email"
                placeholder="name@example.com"
                className="nb-field"
                disabled={isLoading}
                required
                autoFocus
              />
              {error && <ErrorText>{error}</ErrorText>}
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <NbButton type="submit" disabled={isLoading} loading={isLoading}>
                Send code
                <ArrowRight className="ml-2 h-4 w-4" />
              </NbButton>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-[var(--nb-text-muted)]"
                onClick={() => {
                  setError(null);
                  setStep({ kind: "choose" });
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </CardFooter>
          </form>
        )}

        {step.kind === "otp" && (
          <form onSubmit={handleOtpSubmit}>
            <CardHeader className="text-center">
              <CardTitle className="text-lg font-black uppercase text-[var(--nb-text)]">
                Check your email
              </CardTitle>
              <CardDescription className="text-[var(--nb-text-muted)]">
                We sent a 6-digit code to {step.email}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <InputOTP
                  value={otp}
                  onChange={setOtp}
                  maxLength={6}
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                      const form = (e.target as HTMLElement).closest("form");
                      form?.requestSubmit();
                    }
                  }}
                >
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <InputOTPSlot key={index} index={index} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {error && <ErrorText>{error}</ErrorText>}
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <NbButton
                type="submit"
                disabled={isLoading || otp.length !== 6}
                loading={isLoading}
              >
                Verify code
              </NbButton>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-[var(--nb-text-muted)]"
                onClick={() => {
                  setOtp("");
                  setError(null);
                  setStep({ kind: "choose" });
                }}
              >
                Use a different method
              </Button>
            </CardFooter>
          </form>
        )}

        {step.kind === "verified" && (
          <>
            <CardHeader className="text-center">
              <div className="mb-2 flex justify-center">
                <ShieldCheck
                  className="h-8 w-8 text-[#10B981]"
                  strokeWidth={3}
                />
              </div>
              <CardTitle className="text-lg font-black uppercase text-[var(--nb-text)]">
                You are verified
              </CardTitle>
              <CardDescription className="text-[var(--nb-text-muted)]">
                Set a password now and you will never need a code again.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form id="attach-password" onSubmit={handleAttachPassword} className="space-y-3">
                <Input
                  type="password"
                  placeholder="At least 8 characters, with a number"
                  className="nb-field"
                  value={password}
                  disabled={isLoading}
                  minLength={8}
                  required
                  onChange={(e) => setPassword(e.target.value)}
                />
                {error && <ErrorText>{error}</ErrorText>}
                {info && (
                  <p className="border-2 border-[#10B981] bg-[var(--nb-surface-2)] p-2 text-xs font-bold text-[var(--nb-text)]">
                    {info}
                  </p>
                )}
              </form>
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <NbButton
                type="submit"
                form="attach-password"
                disabled={isLoading || password.length < 8}
                loading={isLoading}
              >
                <Lock className="mr-2 h-4 w-4" />
                Set password and continue
              </NbButton>
              <Button
                type="button"
                variant="outline"
                className="w-full border-2 border-[var(--nb-ink)] text-[var(--nb-text)]"
                onClick={handleClaimAdmin}
                disabled={isLoading}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Claim admin for {step.email}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-[var(--nb-text-muted)]"
                onClick={() => navigate(redirect)}
              >
                Skip for now
              </Button>
            </CardFooter>
          </>
        )}

        <p className="border-t-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] px-6 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--nb-text-dim)]">
          Secured by Convex Auth
        </p>
      </Card>
    </div>
  );
}

/** Google is only rendered when the backend reports it as configured. */
function GoogleButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  const options = useQuery(api.authConfig.authOptions);
  if (!options?.google) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="nb-btn w-full justify-center border-2 border-[var(--nb-ink)] bg-[var(--nb-surface)] py-2.5 text-[var(--nb-text)] disabled:opacity-60"
    >
      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
        />
      </svg>
      Continue with Google
    </button>
  );
}

function NbButton({
  children,
  variant = "primary",
  loading,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "alt";
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      className={[
        "nb-btn w-full justify-center py-2.5 disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary"
          ? "bg-[#10B981] text-[#04110C]"
          : "bg-[#06B6D4] text-[#04110C]",
        className ?? "",
      ].join(" ")}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Working...
        </>
      ) : (
        children
      )}
    </button>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 border-2 border-[#F43F5E] bg-[var(--nb-surface-2)] p-2 text-xs font-bold text-[#F43F5E]">
      {children}
    </p>
  );
}

export default function AuthRoute(props: AuthProps) {
  return <Suspense fallback={<AuthSkeleton />}>{<Auth {...props} />}</Suspense>;
}
