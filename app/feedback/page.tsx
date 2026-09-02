import type { Metadata } from "next";
import SubmissionForms from "./SubmissionForms";

export const metadata: Metadata = {
  title: "Feedback & Prayer Requests",
};

export default function FeedbackPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Feedback &amp; Prayer Requests</h1>
        <p className="mt-2 text-ink-soft">
          We would love to hear from you. Every message reaches our team.
        </p>
      </header>

      <SubmissionForms />
    </div>
  );
}
