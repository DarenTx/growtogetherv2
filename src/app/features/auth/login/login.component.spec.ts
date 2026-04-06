import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';
import {
  createMockAuthService,
  createMockProfileService,
} from '../../../core/testing/mock-supabase.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAuth: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockProfile: Record<string, any>;

  beforeEach(async () => {
    mockAuth = createMockAuthService();
    mockProfile = createMockProfileService();

    vi.spyOn(LoginComponent.prototype, 'startGoogleOneTap').mockResolvedValue();

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuth },
        { provide: ProfileService, useValue: mockProfile },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('shows an email validation error on blur for invalid input', () => {
    component.identifierControl.setValue('not-an-email');
    component.onIdentifierBlur();
    expect(component.emailError()).toContain('valid email');
  });

  it('clears the email validation error on blur for valid input', () => {
    component.identifierControl.setValue('user@example.com');
    component.onIdentifierBlur();
    expect(component.emailError()).toBe('');
  });

  it('submits a normalized email magic link request', async () => {
    component.identifierControl.setValue(' User@Example.COM ');
    await component.onSubmit();

    expect(mockAuth['signInWithEmail']).toHaveBeenCalledWith('user@example.com');
    expect(component.state()).toBe('sent');
    expect(component.sentTo()).toBe('user@example.com');
  });

  it('does not submit when the identifier is not an email address', async () => {
    component.identifierControl.setValue('bad-input');
    await component.onSubmit();

    expect(component.emailError()).toContain('valid email');
    expect(mockAuth['signInWithEmail']).not.toHaveBeenCalled();
  });

  it('surfaces auth errors', async () => {
    mockAuth['signInWithEmail'] = vi.fn().mockRejectedValue(new Error('Rate limit reached'));
    component.identifierControl.setValue('user@example.com');

    await component.onSubmit();

    expect(component.state()).toBe('error');
    expect(component.errorMessage()).toContain('Rate limit reached');
  });
});
