export type UserRole = 'student' | 'teacher' | 'admin';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: UserRole;
  tutorialCompleted: boolean;
}

export interface AuthRequest {
  headers: {
    cookie?: string;
    'user-agent'?: string;
    'x-forwarded-proto'?: string;
  };
  deviceId?: string;
  query: Record<string, unknown>;
  user: AuthenticatedUser;
}

export function shouldUseSecureCookie(request: AuthRequest): boolean {
  const forwardedProtocol = request.headers['x-forwarded-proto']
    ?.split(',')[0]
    .trim()
    .toLowerCase();
  return forwardedProtocol
    ? forwardedProtocol === 'https'
    : process.env.NODE_ENV === 'production';
}
