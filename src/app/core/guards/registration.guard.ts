import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const registrationGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const session = await supabase.getSession();
  if (!session) {
    return router.createUrlTree(['/login']);
  }

  const profile = await supabase.getProfile();
  if (!profile?.registration_complete) {
    return router.createUrlTree(['/register']);
  }
  return true;
};
