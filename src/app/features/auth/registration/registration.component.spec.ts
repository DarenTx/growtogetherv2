import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import {
  MOCK_PROFILE_COMPLETE,
  MOCK_PROFILE_INCOMPLETE,
  MOCK_SESSION,
  createMockSupabaseService,
} from '../../../core/testing/mock-supabase.service';
import { RegistrationComponent } from './registration.component';

describe('RegistrationComponent', () => {
  let fixture: ComponentFixture<RegistrationComponent>;
  let component: RegistrationComponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockService: Record<string, any>;
  let router: Router;

  beforeEach(async () => {
    mockService = createMockSupabaseService();
    mockService['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockService['getProfile'] = vi.fn().mockResolvedValue(MOCK_PROFILE_INCOMPLETE);
    mockService['completeRegistration'] = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [RegistrationComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: RegistrationComponent },
          { path: 'login', component: RegistrationComponent },
        ]),
        { provide: SupabaseService, useValue: mockService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrationComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('shows the form after loading', () => {
    expect(component.state()).toBe('ready');
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    expect(form).toBeTruthy();
  });

  it('redirects to /login when no session', async () => {
    mockService['getSession'] = vi.fn().mockResolvedValue(null);
    fixture = TestBed.createComponent(RegistrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('pre-fills email from session user when no existing profile', async () => {
    mockService['getProfile'] = vi.fn().mockResolvedValue(null);
    fixture = TestBed.createComponent(RegistrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(component.emailControl.value).toBe('john@example.com');
  });

  it('pre-fills all fields from existing profile', async () => {
    mockService['getProfile'] = vi.fn().mockResolvedValue(MOCK_PROFILE_COMPLETE);
    fixture = TestBed.createComponent(RegistrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect(component.firstNameControl.value).toBe(MOCK_PROFILE_COMPLETE.first_name);
    expect(component.emailControl.value).toBe(MOCK_PROFILE_COMPLETE.email);
  });

  it('shows all required field errors when form submitted empty', async () => {
    component.form.reset();
    await component.onSubmit();
    fixture.detectChanges();
    const errors = fixture.nativeElement.querySelectorAll('.field-error') as NodeList;
    expect(errors.length).toBeGreaterThan(0);
  });

  it('shows phone error for invalid phone on blur', () => {
    component.phoneControl.setValue('bad-phone');
    component.onPhoneBlur();
    expect(component.phoneError()).toBeTruthy();
  });

  it('clears phone error for a valid phone on blur', () => {
    component.phoneControl.setValue('+12125551234');
    component.onPhoneBlur();
    expect(component.phoneError()).toBe('');
  });

  describe('successful registration', () => {
    beforeEach(async () => {
      component.form.setValue({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '2125551234',
        invitation_code: 'Fruehling',
      });
      await component.onSubmit();
    });

    it('calls completeRegistration with normalized data', () => {
      expect(mockService['completeRegistration']).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone: '+12125551234',
          invitation_code: 'Fruehling',
        }),
      );
    });

    it('navigates to /dashboard on success', () => {
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });
  });

  describe('failed registration — invalid invitation code', () => {
    beforeEach(async () => {
      mockService['completeRegistration'] = vi
        .fn()
        .mockRejectedValue(new Error('Invalid invitation code.'));
      component.form.setValue({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '2125551234',
        invitation_code: 'wrong',
      });
      await component.onSubmit();
      fixture.detectChanges();
    });

    it('shows invalid invitation code message', () => {
      expect(component.errorMessage()).toContain('Invalid invitation code');
    });

    it('resets state to error so form is visible', () => {
      expect(component.state()).toBe('error');
    });
  });

  it('shows phone error and halts submit when phone is invalid format', async () => {
    component.form.setValue({
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      phone: '123',
      invitation_code: 'Fruehling',
    });
    await component.onSubmit();
    expect(component.phoneError()).toBeTruthy();
    expect(mockService['completeRegistration']).not.toHaveBeenCalled();
  });
});
