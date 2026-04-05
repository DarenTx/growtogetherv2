import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TosComponent } from './tos.component';

describe('TosComponent', () => {
  let fixture: ComponentFixture<TosComponent>;
  let component: TosComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TosComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders the page title', () => {
    const title = fixture.nativeElement.querySelector('h1') as HTMLHeadingElement;
    expect(title.textContent?.trim()).toBe('Terms of Service');
  });
});
