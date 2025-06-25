import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.CREATOR_JWT_SECRET || 'creator-secret-key-change-in-production';

export interface CreatorUser {
  id: string;
  email: string;
  username: string;
  company_id: string;
  role: string;
}

export function getCreatorFromToken(): CreatorUser | null {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('creator_token')?.value;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id,
      email: decoded.email,
      username: decoded.username,
      company_id: decoded.company_id,
      role: decoded.role
    };

  } catch (error) {
    console.error('Error verifying creator token:', error);
    return null;
  }
}

export function requireCreatorAuth(): CreatorUser {
  const creator = getCreatorFromToken();
  
  if (!creator) {
    throw new Error('Creator authentication required');
  }
  
  return creator;
}