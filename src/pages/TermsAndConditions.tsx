import { Link } from "react-router-dom";

export default function TermsAndConditions() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-4xl font-bold">Terms and Conditions</h1>
          <Link to="/" className="text-sm text-primary hover:underline">
            Back Home
          </Link>
        </div>
        <div className="space-y-4 rounded-2xl border border-border/40 bg-card/70 p-6 text-sm leading-7 text-muted-foreground">
          <p>Last updated: March 30, 2026</p>
          <p>
            By using this website and submitting comments, reactions, or contact forms, you agree to these terms.
          </p>
          <p>
            You are responsible for the content you submit and agree not to post unlawful, abusive, or misleading material.
            Comments may be moderated, approved, edited for clarity, or removed.
          </p>
          <p>
            Submitting engagement forms requires agreement to data handling as described in the Privacy Policy. You confirm
            that information you submit is accurate.
          </p>
          <p>
            Mustafa may respond to comments by email when requested or relevant. Availability and response timing are not
            guaranteed.
          </p>
          <p>
            All website content remains the intellectual property of Mustafa unless otherwise stated. Do not reproduce content
            without permission.
          </p>
          <p>
            These terms may be updated. Continued use of this site after updates indicates acceptance of the revised terms.
          </p>
        </div>
      </div>
    </main>
  );
}
