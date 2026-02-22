import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { registrationGuard } from './core/guards/registration.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth/callback/auth-callback.component').then(
        (m) => m.AuthCallbackComponent,
      ),
  },
  {
    path: 'auth/link-expired',
    loadComponent: () =>
      import('./features/auth/link-expired/link-expired.component').then(
        (m) => m.LinkExpiredComponent,
      ),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/registration/registration.component').then(
        (m) => m.RegistrationComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [registrationGuard],
  },
  { path: '**', redirectTo: 'login' },
];
