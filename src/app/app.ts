import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  styleUrl: 'app.css',
  template: `
    <div class="app-shell">
      <header class="app-header">
        <img src="icons/icon-96x96.png" alt="Grow Together logo" width="40" height="40" />
        <span class="app-title">Grow Together</span>
      </header>
      <main class="app-main">
        <router-outlet />
      </main>
    </div>
  `,
})
export class App {}
