export function allowedExternalUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    return (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}
