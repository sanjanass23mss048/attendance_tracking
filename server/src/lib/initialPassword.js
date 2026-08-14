import bcrypt from 'bcrypt';

export const INITIAL_PASSWORD = 'Initial1';

export async function hashInitialPassword() {
  return bcrypt.hash(INITIAL_PASSWORD, 10);
}

export async function passwordIsInitial(storedHash) {
  if (!storedHash) return false;
  return bcrypt.compare(INITIAL_PASSWORD, storedHash);
}

/** Admin and teacher accounts must change Initial1 on first login. */
export function roleRequiresInitialPasswordChange(appRole) {
  const role = String(appRole || '').toUpperCase();
  return role === 'ADMIN' || role === 'TEACHER';
}

export async function userRequiresPasswordChange(user, appRole) {
  if (!roleRequiresInitialPasswordChange(appRole)) return false;
  return passwordIsInitial(user.password);
}
