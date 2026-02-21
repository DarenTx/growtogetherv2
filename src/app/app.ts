import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from './supabase.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('grow-together');
  protected readonly supabaseStatus = signal<'checking' | 'connected' | 'error'>('checking');

  constructor(private readonly supabaseService: SupabaseService) {
    void this.checkSupabaseConnection();
  }

  protected async checkSupabaseConnection(): Promise<void> {
    this.supabaseStatus.set('checking');
    const connected = await this.supabaseService.isConnected();
    this.supabaseStatus.set(connected ? 'connected' : 'error');
  }
}
