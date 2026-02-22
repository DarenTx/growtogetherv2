import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-link-expired',
  standalone: true,
  imports: [],
  templateUrl: './link-expired.component.html',
})
export class LinkExpiredComponent {
  constructor(private readonly router: Router) {}

  goToLogin(): void {
    void this.router.navigate(['/login']);
  }
}
