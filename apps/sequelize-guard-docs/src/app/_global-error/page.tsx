export default function GlobalError({
  error,
  reset,
}: {
  error?: Error;
  reset?: () => void;
}) {
  return (
    <div style={{ padding: 32, fontFamily: "sans-serif" }}>
      <h1>Something went wrong</h1>
      <p>There was an error while rendering the application.</p>
      {error ? (
        <pre style={{ whiteSpace: "pre-wrap" }}>{String(error.message)}</pre>
      ) : null}
      {reset ? (
        <button onClick={reset} style={{ marginTop: 12, padding: "8px 12px" }}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
