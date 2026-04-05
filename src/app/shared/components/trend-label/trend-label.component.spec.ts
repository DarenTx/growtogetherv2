import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrendLabelComponent } from './trend-label.component';

describe('TrendLabelComponent', () => {
  let component: TrendLabelComponent;
  let fixture: ComponentFixture<TrendLabelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrendLabelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TrendLabelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', '1,2,3,4,5');
    fixture.detectChanges();
  });

  it('renders with valid data without error', () => {
    expect(component).toBeTruthy();
  });

  // ── parsedValues ──────────────────────────────────────────────────────────

  describe('parsedValues', () => {
    it('extracts numeric values from comma-delimited string', () => {
      fixture.componentRef.setInput('data', '3.5,4.1,2.8');
      expect(component.parsedValues()).toEqual([3.5, 4.1, 2.8]);
    });

    it('filters out non-numeric tokens', () => {
      fixture.componentRef.setInput('data', '1,abc,2,NaN,3');
      expect(component.parsedValues()).toEqual([1, 2, 3]);
    });

    it('returns empty array for empty string', () => {
      fixture.componentRef.setInput('data', '');
      expect(component.parsedValues()).toEqual([]);
    });

    it('trims whitespace around tokens', () => {
      fixture.componentRef.setInput('data', ' 1 , 2 , 3 ');
      expect(component.parsedValues()).toEqual([1, 2, 3]);
    });
  });

  // ── trend ─────────────────────────────────────────────────────────────────

  describe('trend', () => {
    it('returns up when last > second-to-last', () => {
      fixture.componentRef.setInput('data', '3,5');
      expect(component.trend()).toBe('up');
    });

    it('returns down when last < second-to-last', () => {
      fixture.componentRef.setInput('data', '5,3');
      expect(component.trend()).toBe('down');
    });

    it('returns flat when last === second-to-last', () => {
      fixture.componentRef.setInput('data', '4,4');
      expect(component.trend()).toBe('flat');
    });

    it('returns flat when fewer than two values', () => {
      fixture.componentRef.setInput('data', '5');
      expect(component.trend()).toBe('flat');
    });

    it('returns flat for empty data', () => {
      fixture.componentRef.setInput('data', '');
      expect(component.trend()).toBe('flat');
    });
  });

  // ── deltaLabel ────────────────────────────────────────────────────────────

  describe('deltaLabel', () => {
    it('formats positive delta with leading + and two decimal places', () => {
      fixture.componentRef.setInput('data', '2,4.5');
      expect(component.deltaLabel()).toBe('+2.50%');
    });

    it('formats negative delta without extra sign prefix', () => {
      fixture.componentRef.setInput('data', '5,3.8');
      expect(component.deltaLabel()).toBe('-1.20%');
    });

    it('formats zero delta as "0.00%"', () => {
      fixture.componentRef.setInput('data', '3,3');
      expect(component.deltaLabel()).toBe('0.00%');
    });

    it('returns "0.00%" when fewer than two values', () => {
      fixture.componentRef.setInput('data', '7');
      expect(component.deltaLabel()).toBe('0.00%');
    });
  });

  // ── svgPoints ─────────────────────────────────────────────────────────────

  describe('svgPoints', () => {
    it('returns empty string for empty data', () => {
      fixture.componentRef.setInput('data', '');
      expect(component.svgPoints()).toBe('');
    });

    it('returns empty string for single value', () => {
      fixture.componentRef.setInput('data', '5');
      expect(component.svgPoints()).toBe('');
    });

    it('returns empty string for two values', () => {
      fixture.componentRef.setInput('data', '0,100');
      const points = component.svgPoints();
      expect(points).toBe('');
    });

    it('first point has x=0 and last point has x=100', () => {
      fixture.componentRef.setInput('data', '1,2,3,4,5');
      const pairs = component.svgPoints().split(' ');
      const [x0] = pairs[0].split(',').map(Number);
      const [xN] = pairs[pairs.length - 1].split(',').map(Number);
      expect(x0).toBe(0);
      expect(xN).toBe(100);
    });

    it('produces flat midpoint line for identical values (y = H/2 = 16)', () => {
      fixture.componentRef.setInput('data', '5,5,5');
      const pairs = component.svgPoints().split(' ');
      for (const pair of pairs) {
        const [, y] = pair.split(',').map(Number);
        expect(y).toBe(16);
      }
    });

    it('higher values produce smaller y (appear higher in chart)', () => {
      fixture.componentRef.setInput('data', '1,5,10');
      const pairs = component.svgPoints().split(' ');
      const [, y0] = pairs[0].split(',').map(Number); // value=1 (low)
      const [, y2] = pairs[2].split(',').map(Number); // value=10 (high)
      expect(y0).toBeGreaterThan(y2);
    });

    it('supports negative values', () => {
      fixture.componentRef.setInput('data', '-5,-2,-8');
      const points = component.svgPoints();
      expect(points).toBeTruthy();
      expect(points.split(' ').length).toBe(3);
    });
  });

  // ── sparkline SVG visibility (structural @if based on data count) ─────────

  describe('sparkline SVG visibility', () => {
    it('SVG is not rendered when data has one value', () => {
      fixture.componentRef.setInput('data', '5');
      fixture.detectChanges();
      const svg = fixture.nativeElement.querySelector('svg[preserveAspectRatio="none"]');
      expect(svg).toBeNull();
    });

    it('SVG is not rendered when data has exactly two values', () => {
      fixture.componentRef.setInput('data', '1,5');
      fixture.detectChanges();
      const svg = fixture.nativeElement.querySelector('svg[preserveAspectRatio="none"]');
      expect(svg).toBeNull();
    });

    it('SVG is rendered when data has exactly three values', () => {
      fixture.componentRef.setInput('data', '1,2,3');
      fixture.detectChanges();
      const svg = fixture.nativeElement.querySelector('svg[preserveAspectRatio="none"]');
      expect(svg).toBeTruthy();
    });

    it('SVG is rendered with five values (default in beforeEach)', () => {
      const svg = fixture.nativeElement.querySelector('svg[preserveAspectRatio="none"]');
      expect(svg).toBeTruthy();
    });
  });

  // ── showIcon ──────────────────────────────────────────────────────────────

  describe('showIcon input', () => {
    it('icon wrapper remains in DOM when showIcon is false', () => {
      fixture.componentRef.setInput('data', '1,5');
      fixture.componentRef.setInput('showIcon', false);
      fixture.detectChanges();
      const iconSpan = fixture.nativeElement.querySelector('span.inline-flex');
      expect(iconSpan).toBeTruthy();
    });

    it('icon wrapper has visibility:collapse when showIcon is false', () => {
      fixture.componentRef.setInput('data', '1,5');
      fixture.componentRef.setInput('showIcon', false);
      fixture.detectChanges();
      const iconSpan = fixture.nativeElement.querySelector('span.inline-flex');
      expect(iconSpan.style.visibility).toBe('collapse');
    });
  });

  // ── showText ──────────────────────────────────────────────────────────────

  describe('showText input', () => {
    it('delta span remains in DOM when showText is false', () => {
      fixture.componentRef.setInput('showText', false);
      fixture.detectChanges();
      const span = fixture.nativeElement.querySelector('span.text-xs');
      expect(span).toBeTruthy();
    });

    it('delta span has visibility:collapse when showText is false', () => {
      fixture.componentRef.setInput('showText', false);
      fixture.detectChanges();
      const span = fixture.nativeElement.querySelector('span.text-xs');
      expect(span.style.visibility).toBe('collapse');
    });
  });

  // ── flat trend icon visibility ────────────────────────────────────────────

  describe('flat trend', () => {
    it('icon wrapper remains in DOM when trend is flat', () => {
      fixture.componentRef.setInput('data', '4,4');
      fixture.detectChanges();
      const iconSpan = fixture.nativeElement.querySelector('span.inline-flex');
      expect(iconSpan).toBeTruthy();
    });

    it('icon wrapper has visibility:collapse when trend is flat', () => {
      fixture.componentRef.setInput('data', '4,4');
      fixture.detectChanges();
      const iconSpan = fixture.nativeElement.querySelector('span.inline-flex');
      expect(iconSpan.style.visibility).toBe('collapse');
    });

    it('delta text shows "0.00%" in gray when flat', () => {
      fixture.componentRef.setInput('data', '4,4');
      fixture.detectChanges();
      const span = fixture.nativeElement.querySelector('span.text-xs');
      expect(span.textContent.trim()).toBe('0.00%');
    });
  });

  // ── sr-only accessibility span ────────────────────────────────────────────

  describe('sr-only accessibility span', () => {
    it('renders sr-only span when both showIcon and showText are false and data is valid', () => {
      fixture.componentRef.setInput('data', '1,3');
      fixture.componentRef.setInput('showIcon', false);
      fixture.componentRef.setInput('showText', false);
      fixture.detectChanges();
      const srOnly = fixture.nativeElement.querySelector('.sr-only');
      expect(srOnly).toBeTruthy();
      expect(srOnly.textContent.trim()).toBe('+2.00%');
    });

    it('does not render sr-only span when showText is true', () => {
      fixture.componentRef.setInput('data', '1,3');
      fixture.componentRef.setInput('showIcon', false);
      fixture.componentRef.setInput('showText', true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.sr-only')).toBeNull();
    });

    it('does not render sr-only span when showIcon is true', () => {
      fixture.componentRef.setInput('data', '1,3');
      fixture.componentRef.setInput('showIcon', true);
      fixture.componentRef.setInput('showText', false);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.sr-only')).toBeNull();
    });

    it('does not render sr-only span when data has fewer than two valid values', () => {
      fixture.componentRef.setInput('data', '5');
      fixture.componentRef.setInput('showIcon', false);
      fixture.componentRef.setInput('showText', false);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.sr-only')).toBeNull();
    });
  });
});
