export function isPermissionToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    (value === '*' ||
      (!value.includes('\u0000') && !/[\s*\uD800-\uDFFF]/u.test(value)))
  );
}

export function parsePermissionRequest(value: unknown) {
  if (typeof value !== 'string') return null;
  const request = value.trim();
  if (request === '*') return { action: '*', resource: '*' };

  const tokens = request.split(/\s+/u);
  const [action, resource] = tokens;
  return tokens.length === 2 &&
    isPermissionToken(action) &&
    isPermissionToken(resource)
    ? { action, resource }
    : null;
}

export function readPermissionActions(action: unknown): string[] | null {
  if (typeof action !== 'string') return null;
  try {
    const actions: unknown = JSON.parse(action);
    return Array.isArray(actions) &&
      actions.length > 0 &&
      actions.every(isPermissionToken)
      ? actions
      : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}
