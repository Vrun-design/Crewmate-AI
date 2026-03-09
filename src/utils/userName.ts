export function getDisplayNameFromEmail(email: string | null | undefined): string {
  if (!email) {
    return 'User';
  }

  const [rawName] = email.split('@');
  if (!rawName) {
    return 'User';
  }

  return rawName.charAt(0).toUpperCase() + rawName.slice(1);
}
