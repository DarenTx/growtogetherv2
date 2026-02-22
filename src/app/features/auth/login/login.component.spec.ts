import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { createMockSupabaseService } from '../../../core/testing/mock-supabase.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockService: Record<string, any>;

  beforeEach(async () => {
    mockService = createMockSupabaseService();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), { provide: SupabaseService, useValue: mockService }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders the sign-in heading', () => {
    const h1 = fixture.nativeElement.querySelector('h1') as HTMLElement;
    expect(h1.textContent).toContain('Sign in');
  });

  it('shows required error when form submitted empty', async () => {
    const button = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    const error = fixture.nativeElement.querySelector('.field-error') as HTMLElement;
    expect(error?.textContent).toContain('required');
  });

  it('shows phone error for invalid phone number on blur', () => {
    component.identifierControl.setValue('123');
    component.onIdentifierBlur();
    fixture.detectChanges();
    expect(component.phoneError()).toBeTruthy();
  });

  it('clears phone error when input is empty on blur', () => {
    component.identifierControl.setValue('');
    component.onIdentifierBlur();
    expect(component.phoneError()).toBe('');
  });

  it('does not show phone error for a valid email', () => {
    component.identifierControl.setValue('user@example.com');
    component.onIdentifierBlur();
    expect(component.phoneError()).toBe('');
  });

  it('does not show phone error for a valid phone', () => {
    component.identifierControl.setValue('2125551234');
    component.onIdentifierBlur();
    expect(component.phoneError()).toBe('');
  });

  describe('successful submission with email', () => {
    beforeEach(async () => {
      mockService['signInWithEmail'] = vi.fn().mockResolvedValue(undefined);
      component.identifierControl.setValue('user@example.com');
      await component.onSubmit();
      fixture.detectChanges();
    });

    it('sets state to sent', () => {
      expect(component.state()).toBe('sent');
    });

    it('shows the sent message', () => {
      const h1 = fixture.nativeElement.querySelector('h1') as HTMLElement;
      expect(h1.textContent?.toLowerCase()).toContain('check');
    });

    it('calls signInWithEmail with normalized email', () => {
      expect(mockService['signInWithEmail']).toHaveBeenCalledWith('user@example.com');
    });
  });

  describe('successful submission with phone', () => {
    beforeEach(async () => {
      mockService['signInWithPhone'] = vi.fn().mockResolvedValue(undefined);
      component.identifierControl.setValue('2125551234');
      await component.onSubmit();
      fixture.detectChanges();
    });

    it('sets state to sent', () => {
      expect(component.state()).toBe('sent');
    });

    it('calls signInWithPhone with E.164 phone', () => {
      expect(mockService['signInWithPhone']).toHaveBeenCalledWith('+12125551234');
    });
  });

  describe('submission with invalid phone', () => {
    beforeEach(async () => {
      component.identifierControl.setValue('notaphone');
      await component.onSubmit();
      fixture.detectChanges();
    });

    it('sets phoneError', () => {
      expect(component.phoneError()).toBeTruthy();
    });

    it('does not call any sign-in method', () => {
      expect(mockService['signInWithEmail']).not.toHaveBeenCalled();
      expect(mockService['signInWithPhone']).not.toHaveBeenCalled();
    });
  });

  describe('on sign-in error', () => {
    beforeEach(async () => {
      mockService['signInWithEmail'] = vi.fn().mockRejectedValue(new Error('Rate limit reached'));
      component.identifierControl.setValue('user@example.com');
      await component.onSubmit();
      fixture.detectChanges();
    });

    it('sets state to error', () => {
      expect(component.state()).toBe('error');
    });

    it('displays the error message', () => {
      expect(component.errorMessage()).toContain('Rate limit');
    });
  });

  it('tryAgain resets state and form', () => {
    component['state'].set('error');
    component.tryAgain();
    expect(component.state()).toBe('idle');
    expect(component.form.value.identifier).toBeFalsy();
  });
});
