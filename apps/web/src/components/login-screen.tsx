"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "./auth-context";

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@moyomoyo.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <img src="/moyomoyo-logo.png" alt="Moyomoyo" width={96} height={46} />
          <p>Warehouse administration</p>
        </div>
        <h1>Sign in</h1>
        <p className="login-copy">Enter your administrator credentials to open the operations console.</p>
        <form className="login-form" onSubmit={(event) => void onSubmit(event)}>
          <label>
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="button button-primary" type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in as admin"}
          </button>
        </form>
      </section>
    </main>
  );
}
