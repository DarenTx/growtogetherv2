import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const adminGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const session = await supabase.getSession();
  if (!session) {
    return router.createUrlTree(['/login']);
  }

  const isAdmin = await supabase.isAdmin();
  if (!isAdmin) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};
