import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Profile } from '../../core/models/profile.interface';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  readonly profile = signal<Profile | null>(null);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    const p = await this.supabase.getProfile();
    this.profile.set(p);
  }

  async signOut(): Promise<void> {
    await this.supabase.signOut();
    await this.router.navigate(['/login']);
  }
}
