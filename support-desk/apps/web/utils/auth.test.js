import { canAccessAdmin } from './auth';

test('super_admin can access admin panel', () => {
  expect(canAccessAdmin('super_admin')).toBe(true);
});

test('normal user cannot access admin panel', () => {
  expect(canAccessAdmin('user')).toBe(false);
});
