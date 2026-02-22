import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LinkExpiredComponent } from './link-expired.component';

describe('LinkExpiredComponent', () => {
  let fixture: ComponentFixture<LinkExpiredComponent>;
  let component: LinkExpiredComponent;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LinkExpiredComponent],
      providers: [provideRouter([{ path: 'login', component: LinkExpiredComponent }])],
    }).compileComponents();

    fixture = TestBed.createComponent(LinkExpiredComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('displays the expired link message', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent?.toLowerCase()).toContain('expired');
  });

  it('navigates to /login when back button clicked', () => {
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('goToLogin navigates to /login', () => {
    component.goToLogin();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
