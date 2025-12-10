'use client';

import { useEffect } from 'react';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <div className="max-w-md space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-6">
            <AlertCircle className="h-16 w-16 text-red-600 dark:text-red-400" />
          </div>
        </div>

        {/* Error Message */}
        <div>
          <h1 className="text-4xl font-bold text-fd-foreground">
            Oops! Something went wrong
          </h1>
          <p className="mt-2 text-lg text-fd-muted-foreground">
            We encountered an unexpected error while loading this page.
          </p>
        </div>

        {/* Error Details (in development) */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="text-left bg-fd-muted p-4 rounded-lg max-w-full overflow-auto">
            <p className="text-sm font-mono text-fd-foreground break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-fd-muted-foreground mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-fd-primary px-6 py-3 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-fd-border px-6 py-3 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
          >
            <Home className="h-4 w-4" />
            Go Home
          </a>
        </div>

        {/* Help Text */}
        <div className="pt-8 border-t border-fd-border">
          <p className="text-sm text-fd-muted-foreground">
            If this problem persists, please{' '}
            <a
              href="https://github.com/lotivo/sequelize-guard/issues"
              className="text-fd-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              report an issue on GitHub
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
