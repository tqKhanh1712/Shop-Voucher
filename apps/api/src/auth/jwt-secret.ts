const MINIMUM_JWT_SECRET_LENGTH = 32;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < MINIMUM_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET is required and must contain at least ${MINIMUM_JWT_SECRET_LENGTH} characters.`,
    );
  }

  return secret;
}
