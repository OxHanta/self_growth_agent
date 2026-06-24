import { config } from '../config';

export function isAuthorized(userId: number): boolean {
  return userId === config.telegram.userId;
}
