import Link from 'next/link';
import { FileQuestion, Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <div className="max-w-md space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-fd-primary/10 p-6">
            <FileQuestion className="h-16 w-16 text-fd-primary" />
          </div>
        </div>

        {/* Error Code */}
        <div>
          <h1 className="text-6xl font-bold text-fd-foreground">404</h1>
          <p className="mt-2 text-xl font-semibold text-fd-foreground">
            Page Not Found
          </p>
        </div>

        {/* Description */}
        <p className="text-fd-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-fd-primary px-6 py-3 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-fd-border px-6 py-3 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
          >
            <Search className="h-4 w-4" />
            Browse Docs
          </Link>
        </div>

        {/* Helpful Links */}
        <div className="pt-8 border-t border-fd-border">
          <p className="text-sm text-fd-muted-foreground mb-3">
            Looking for something specific?
          </p>
          <div className="flex flex-wrap gap-2 justify-center text-sm">
            <Link
              href="/docs"
              className="text-fd-primary hover:underline"
            >
              Documentation
            </Link>
            <span className="text-fd-muted-foreground">•</span>
            <Link
              href="/docs/guide/getting-started"
              className="text-fd-primary hover:underline"
            >
              Getting Started
            </Link>
            <span className="text-fd-muted-foreground">•</span>
            <Link
              href="https://github.com/lotivo/sequelize-guard"
              className="text-fd-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
