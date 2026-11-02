import { useState } from "react";
import { useNavigate } from "react-router";

import { useLogin } from "../features/auth/hooks/useLogin";
import { useRegister } from "../features/auth/hooks/useRegister";

import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../components/ui/card";
import { Input } from "../components/ui/input";

export default function AuthPage() {
  const navigate = useNavigate();

  const login = useLogin();
  const register = useRegister();

  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");

  const isLoading = login.isPending || register.isPending;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!form.email.includes("@")) {
      newErrors.email = "Invalid email";
    }

    if (form.password.length < 6) {
      newErrors.password = "Minimum 6 characters";
    }

    if (isRegister) {
      if (!form.firstName) newErrors.firstName = "Required";
      if (!form.lastName) newErrors.lastName = "Required";
      if (form.password !== form.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");

    if (!validateForm()) return;

    if (isRegister) {
      register.mutate(form, {
        onSuccess: () => navigate("/teams"),
        onError: () => setServerError("Registration failed"),
      });
    } else {
      login.mutate(
        { email: form.email, password: form.password },
        {
          onSuccess: () => navigate("/teams"),
          onError: () => setServerError("Invalid credentials"),
        },
      );
    }
  };

  return (
    // <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background px-4">
    <div className="min-h-screen flex items-center justify-center bg-main-layout bg-cover bg-center px-4">
      <Card className="w-full max-w-md rounded-2xl border-border/60 shadow-xl">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-semibold">
            {isRegister ? "Create your account" : "Welcome back"}
          </CardTitle>

          <CardDescription>
            {isRegister
              ? "Enter your details to get started"
              : "Sign in to continue"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  name="firstName"
                  placeholder="First name"
                  value={form.firstName}
                  onChange={handleChange}
                />
                <Input
                  name="lastName"
                  placeholder="Last name"
                  value={form.lastName}
                  onChange={handleChange}
                />
              </div>
            )}

            <Input
              name="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
            />

            <div className="relative">
              <Input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                className="pr-10"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {isRegister && (
              <div className="relative">
                <Input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
            )}

            {Object.values(errors).length > 0 && (
              <div className="text-xs text-destructive space-y-1">
                {Object.values(errors).map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}

            {serverError && (
              <div className="text-sm text-destructive text-center">
                {serverError}
              </div>
            )}

            <Button type="submit" className="w-full h-11" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Please wait
                </span>
              ) : isRegister ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="text-center text-sm mt-4">
            {isRegister ? (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => setIsRegister(false)}
                  className="cursor-pointer text-primary hover:underline"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don’t have an account?{" "}
                <button
                  onClick={() => setIsRegister(true)}
                  className="text-primary hover:underline"
                >
                  Create account
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
