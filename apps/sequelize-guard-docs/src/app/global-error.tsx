'use client'; // Must be a Client Component

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log the error for debugging purposes
  useEffect(() => {
    console.error('Global Error:', error);
  }, [error]);

  return (
    // Must include <html> and <body>
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-background">
          <div className="max-w-md space-y-6">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-6">
                <AlertTriangle className="h-16 w-16 text-red-600 dark:text-red-400" />
              </div>
            </div>

            {/* Error Message */}
            <div>
              <h1 className="text-4xl font-bold text-foreground">
                Something went wrong!
              </h1>
              <p className="mt-2 text-lg text-muted-foreground">
                An unexpected error occurred in the application.
              </p>
            </div>

            {/* Error Details (in development) */}
            {process.env.NODE_ENV === 'development' && (
              <div className="text-left bg-muted p-4 rounded-lg max-w-full overflow-auto">
                <p className="text-sm font-mono text-foreground break-all">
                  {error.message}
                </p>
                {error.digest && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Error ID: {error.digest}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <button
                onClick={() => reset()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Try Again
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Go Home
              </a>
            </div>

            {/* Help Text */}
            <p className="text-sm text-muted-foreground pt-4">
              If this problem persists, please contact support or{' '}
              <a
                href="https://github.com/lotivo/sequelize-guard/issues"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                report an issue
              </a>
              .
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
