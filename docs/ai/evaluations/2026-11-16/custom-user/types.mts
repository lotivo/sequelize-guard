import type { startGuard } from './app.mjs';

// Compiled but deliberately never called: these are declaration contract checks.
export async function assertAccountTypes(guard: Awaited<ReturnType<typeof startGuard>>) {
  const Users = guard.models().GuardUser;
  const account = await Users.create({ accountKey: 'typed-account', email: 'typed@example.test' });
  const key: string = account.accountKey;
  const email: string = account.email;
  const can: boolean = await account.can('read article');
  void [key, email, can];
  // @ts-expect-error Application email remains required.
  await Users.create({ accountKey: 'missing-email' });
  // @ts-expect-error Application key remains required.
  await Users.create({ email: 'missing-key@example.test' });
  // @ts-expect-error Application string key must not widen to a number.
  await Users.create({ accountKey: 42, email: 'bad-key@example.test' });
  // @ts-expect-error Application email remains a string.
  await Users.create({ accountKey: 'bad-email', email: 42 });
  // @ts-expect-error Returned key remains a string.
  const numericKey: number = account.accountKey;
  void numericKey;
}
