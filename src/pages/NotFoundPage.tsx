import { Link } from "react-router-dom";
import { Container } from "../components/layout/Container";

export default function NotFoundPage() {
  return (
    <Container className="py-12">
      <h1 className="text-[28px] font-semibold leading-[34px] text-ink">Page not found</h1>
      <p className="mt-4 text-ink-muted">
        <Link to="/" className="underline underline-offset-4 hover:text-ink">
          Back to PLAYROOM
        </Link>
      </p>
    </Container>
  );
}
