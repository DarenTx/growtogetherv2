import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgClass } from '@angular/common';

const W = 100;
const H = 32;
const PADDING_Y = 4;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

@Component({
  selector: 'app-trend-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './trend-label.component.html',
  styleUrl: './trend-label.component.css',
})
export class TrendLabelComponent {
  readonly data = input.required<string>();
  readonly showIcon = input(true);
  readonly showText = input(true);

  readonly parsedValues = computed(() =>
    this.data()
      .split(',')
      .map((token) => parseFloat(token.trim()))
      .filter((n) => !isNaN(n)),
  );

  readonly trend = computed((): 'up' | 'down' | 'flat' => {
    const values = this.parsedValues();
    if (values.length < 2) return 'flat';
    const last = values[values.length - 1];
    const prev = values[values.length - 2];
    if (last > prev) return 'up';
    if (last < prev) return 'down';
    return 'flat';
  });

  readonly delta = computed((): number => {
    const values = this.parsedValues();
    if (values.length < 2) return 0;
    return values[values.length - 1] - values[values.length - 2];
  });

  readonly deltaLabel = computed((): string => {
    const d = this.delta();
    return d > 0 ? `+${d.toFixed(2)}%` : `${d.toFixed(2)}%`;
  });

  /**
   * Normalises parsedValues to SVG coordinate space.
   * Higher data values map to smaller y (upper part of the SVG) for natural visual direction.
   */
  readonly svgPoints = computed((): string => {
    const values = this.parsedValues();
    if (values.length < 3) return '';
    const n = values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return values
      .map((v, i) => {
        const x = (i / (n - 1)) * W;
        const y =
          min === max ? H / 2 : H - PADDING_Y - ((v - min) / (max - min)) * (H - 2 * PADDING_Y);
        return `${round1(x)},${round1(y)}`;
      })
      .join(' ');
  });

  readonly iconHidden = computed(() => !this.showIcon() || this.trend() === 'flat');

  readonly showSrOnly = computed(
    () => !this.showIcon() && !this.showText() && this.parsedValues().length >= 2,
  );
}
