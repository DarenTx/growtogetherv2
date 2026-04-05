import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <footer class="py-4 text-center text-xs text-gray-500">
      <p>&copy; {{ currentYear }} Grow Together. Created by AI.</p>
    </footer>
  `,
})
export class Footer {
  currentYear = new Date().getFullYear();
}
