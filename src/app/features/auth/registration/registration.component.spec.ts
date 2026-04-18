import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';
import {
  MOCK_PROFILE_COMPLETE,
  MOCK_PROFILE_INCOMPLETE,
  MOCK_SESSION,
  createMockAuthService,
  createMockProfileService,
} from '../../../core/testing/mock-supabase.service';
import { RegistrationComponent } from './registration.component';

describe('RegistrationComponent', () => {
  let fixture: ComponentFixture<RegistrationComponent>;
  let component: RegistrationComponent;
  let router: Router;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAuth: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockProfile: Record<string, any>;

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(RegistrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockAuth = createMockAuthService();
    mockProfile = createMockProfileService();
    mockAuth['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockProfile['getProfile'] = vi.fn().mockResolvedValue(MOCK_PROFILE_INCOMPLETE);

    await TestBed.configureTestingModule({
      imports: [RegistrationComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: RegistrationComponent },
          { path: 'login', component: RegistrationComponent },
        ]),
        { provide: AuthService, useValue: mockAuth },
        { provide: ProfileService, useValue: mockProfile },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('creates the component', async () => {
    await createComponent();
    expect(component).toBeTruthy();
  });

  it('prefills the personal email from the authenticated user', async () => {
    mockProfile['getProfile'] = vi.fn().mockResolvedValue(null);
    await createComponent();
    expect(component.personalEmailControl.value).toBe('john@example.com');
  });

  it('prefills work and personal email from an existing profile', async () => {
    mockProfile['getProfile'] = vi.fn().mockResolvedValue(MOCK_PROFILE_COMPLETE);
    await createComponent();
    expect(component.workEmailControl.value).toBe(MOCK_PROFILE_COMPLETE.work_email);
    expect(component.personalEmailControl.value).toBe(MOCK_PROFILE_COMPLETE.personal_email);
  });

  it('redirects to login when no session exists', async () => {
    mockAuth['getSession'] = vi.fn().mockResolvedValue(null);
    await createComponent();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('submits normalized work and personal emails', async () => {
    await createComponent();
    component.form.setValue({
      first_name: 'John',
      last_name: 'Doe',
      work_email: 'John@Example.COM',
      personal_email: 'John.Personal@Example.COM',
      invitation_code: 'Fruehling',
    });

    await component.onSubmit();

    expect(mockProfile['completeRegistration']).toHaveBeenCalledWith({
      first_name: 'John',
      last_name: 'Doe',
      work_email: 'john@example.com',
      personal_email: 'john.personal@example.com',
      invitation_code: 'Fruehling',
    });
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('surfaces invalid invitation code errors', async () => {
    mockProfile['completeRegistration'] = vi
      .fn()
      .mockRejectedValue(new Error('Invalid invitation code.'));
    await createComponent();
    component.form.setValue({
      first_name: 'John',
      last_name: 'Doe',
      work_email: 'john@example.com',
      personal_email: 'john.personal@example.com',
      invitation_code: 'wrong',
    });

    await component.onSubmit();

    expect(component.state()).toBe('error');
    expect(component.errorMessage()).toContain('Invalid invitation code');
  });

  it('blocks fmr.com personal email addresses', async () => {
    await createComponent();
    component.form.setValue({
      first_name: 'John',
      last_name: 'Doe',
      work_email: 'john@example.com',
      personal_email: 'john@fmr.com',
      invitation_code: 'Fruehling',
    });

    await component.onSubmit();

    expect(component.personalEmailControl.hasError('fmrDomain')).toBe(true);
    expect(mockProfile['completeRegistration']).not.toHaveBeenCalled();
  });

  it('surfaces no-match PRR data errors', async () => {
    mockProfile['completeRegistration'] = vi
      .fn()
      .mockRejectedValue(
        new Error(
          'No unclaimed PRR data found. Either your personal or work email must match the email that receives PRR notifications.',
        ),
      );
    await createComponent();
    component.form.setValue({
      first_name: 'John',
      last_name: 'Doe',
      work_email: 'john@example.com',
      personal_email: 'john.personal@example.com',
      invitation_code: 'Fruehling',
    });

    await component.onSubmit();

    expect(component.state()).toBe('error');
    expect(component.errorMessage()).toContain(
      'must match the email that receives PRR notifications',
    );
  });
});
