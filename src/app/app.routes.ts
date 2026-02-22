import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
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
  {
    path: 'admin',
    canActivate: [adminGuard],
    children: [
      {
        path: 'profiles',
        loadComponent: () =>
          import('./features/admin/profiles/enter-profiles.component').then(
            (m) => m.EnterProfilesComponent,
          ),
      },
      {
        path: 'market-data',
        loadComponent: () =>
          import('./features/admin/market-data/enter-market-data.component').then(
            (m) => m.EnterMarketDataComponent,
          ),
      },
      {
        path: 'historical-data',
        loadComponent: () =>
          import('./features/admin/historical-data/enter-historical-data.component').then(
            (m) => m.EnterHistoricalDataComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
