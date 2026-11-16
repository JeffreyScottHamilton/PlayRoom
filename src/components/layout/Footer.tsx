import { Container } from "./Container";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-line">
      <Container className="flex flex-col gap-2 py-8 text-[14px] leading-[20px] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="text-ink">The games you grew up with.</p>
        <p>
          <a
            href="https://ruffle.rs/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-ink"
          >
            Flash emulation by Ruffle
          </a>
        </p>
        <p>Games are credited to their creators.</p>
      </Container>
    </footer>
  );
}
