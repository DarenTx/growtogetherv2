import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const session = await auth.getSession({ retries: 3, retryDelayMs: 150 });
  if (!session) {
    return router.createUrlTree(['/login']);
  }
  return true;
};
