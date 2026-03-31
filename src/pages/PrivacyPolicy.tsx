import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-4xl font-bold">Privacy Policy</h1>
          <div className="flex items-center gap-3">
            <Link to="/terms-and-conditions" className="text-sm text-primary hover:underline">
              Terms
            </Link>
            <Link to="/" className="text-sm text-primary hover:underline">
              Back Home
            </Link>
          </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-border/40 bg-card/70 p-6 text-sm leading-7 text-muted-foreground">
          <p>Last updated: March 30, 2026</p>
          <p>
            This site collects limited personal data when you submit a blog comment, react to a post, or contact Mustafa
            through forms.
          </p>
          <p>
            Collected data can include your name, email address, comment content, and interaction type (like/dislike). This
            data is stored to moderate discussion, protect against abuse, and enable follow-up replies.
          </p>
          <p>
            By checking consent boxes in site forms, you agree to this storage and processing. You can request deletion of
            your data by emailing Mustafa via the contact section.
          </p>
          <p>
            Email addresses may be used to notify you when Mustafa replies to your comment. The site does not sell your data.
          </p>
          <p>
            Reasonable security safeguards are used, but no online system can guarantee absolute security. Please avoid sharing
            sensitive personal information in comments.
          </p>
          <p>
            Policy updates may occur over time. Continued use of engagement features after updates indicates acceptance of the
            revised policy.
          </p>
        </div>
      </div>
    </main>
  );
}
