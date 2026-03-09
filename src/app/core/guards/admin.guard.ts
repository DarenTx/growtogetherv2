import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ProfileService } from '../services/profile.service';

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const profileService = inject(ProfileService);
  const router = inject(Router);

  const session = await auth.getSession();
  if (!session) {
    return router.createUrlTree(['/login']);
  }

  const isAdmin = await profileService.isAdmin();
  if (!isAdmin) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};
