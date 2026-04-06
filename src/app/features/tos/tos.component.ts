import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-tos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './tos.component.html',
  styleUrl: './tos.component.css',
})
export class TosComponent {
  protected readonly effectiveDate = 'April 5, 2026';
}
