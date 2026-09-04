"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitFeedback, submitPrayer, type SubmitResult } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-ember px-5 py-2.5 font-semibold text-white transition-colors hover:bg-ember-dark disabled:opacity-60"
    >
      {pending ? "Sending..." : label}
    </button>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">
        {label}
        {!required && <span className="text-ink-soft"> (optional)</span>}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        className="w-full rounded-lg border border-sand bg-surface-2 px-3 py-2 outline-none focus:border-ember"
      />
    </label>
  );
}

function FormCard({
  title,
  description,
  action,
  buttonLabel,
}: {
  title: string;
  description: string;
  action: (prev: SubmitResult | null, formData: FormData) => Promise<SubmitResult>;
  buttonLabel: string;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <section className="rounded-xl border border-sand bg-surface p-6">
      <h2 className="m-0 text-xl text-gold">{title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{description}</p>

      {state?.ok ? (
        <p className="mt-4 rounded-lg bg-sand/70 p-4 text-ink">{state.message}</p>
      ) : (
        <form action={formAction} className="mt-4 space-y-4">
          <Field label="Your name" name="name" />
          <Field label="Email" name="email" type="email" />

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Message</span>
            <textarea
              name="message"
              required
              rows={5}
              className="w-full rounded-lg border border-sand bg-surface-2 px-3 py-2 outline-none focus:border-ember"
            />
          </label>

          {/* Honeypot - hidden from people, ignore it */}
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />

          {state && !state.ok ? (
            <p className="m-0 text-sm text-red-300">{state.message}</p>
          ) : null}

          <SubmitButton label={buttonLabel} />
        </form>
      )}
    </section>
  );
}

export default function SubmissionForms() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <FormCard
        title="Share Feedback"
        description="Tell us what you enjoy, what you'd like to hear, or how the station has encouraged you."
        action={submitFeedback}
        buttonLabel="Send Feedback"
      />
      <FormCard
        title="Prayer Request"
        description="Send a request and our team will pray with you. Share as much or as little as you wish."
        action={submitPrayer}
        buttonLabel="Send Prayer Request"
      />
    </div>
  );
}
