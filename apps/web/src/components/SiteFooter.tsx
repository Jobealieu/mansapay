// Single place to change the credit line.
export const FOOTER_CREDIT_NAME = 'Alieu O. Jobe';

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-border px-4 py-6 text-center text-xs text-fg-muted">
      Built by {FOOTER_CREDIT_NAME}
    </footer>
  );
}
