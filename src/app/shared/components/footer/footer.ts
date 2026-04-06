import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { class: 'block' },
  template: `
    <footer class="py-4 text-center text-xs text-gray-500">
      <p>&copy; {{ currentYear }} Grow Together. Created by AI.</p>
      <p class="space-x-3">
        <a routerLink="/privacy" class="text-blue-600 underline">Privacy Policy</a>
        <a routerLink="/tos" class="text-blue-600 underline">Terms of Service</a>
      </p>
    </footer>
  `,
})
export class Footer {
  currentYear = new Date().getFullYear();
}
