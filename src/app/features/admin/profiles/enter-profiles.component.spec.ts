import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import {
  MOCK_PROFILE_COMPLETE,
  createMockSupabaseService,
} from '../../../core/testing/mock-supabase.service';
import { EnterProfilesComponent } from './enter-profiles.component';

const MOCK_PROFILES = [MOCK_PROFILE_COMPLETE];

describe('EnterProfilesComponent', () => {
  let fixture: ComponentFixture<EnterProfilesComponent>;
  let component: EnterProfilesComponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockService: Record<string, any>;

  beforeEach(async () => {
    mockService = createMockSupabaseService();
    mockService['getAllProfiles'] = vi.fn().mockResolvedValue(MOCK_PROFILES);
    mockService['adminCreateProfile'] = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [EnterProfilesComponent],
      providers: [provideRouter([]), { provide: SupabaseService, useValue: mockService }],
    }).compileComponents();

    fixture = TestBed.createComponent(EnterProfilesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('loads profiles on init', () => {
    expect(mockService['getAllProfiles']).toHaveBeenCalled();
    expect(component.profiles()).toEqual(MOCK_PROFILES);
  });

  it('shows validation errors when submitting empty form', async () => {
    await component.onSubmit();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('required');
  });

  it('calls adminCreateProfile on valid submit and clears form', async () => {
    component.form.setValue({
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
    });
    await component.onSubmit();
    expect(mockService['adminCreateProfile']).toHaveBeenCalledWith({
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
    });
    expect(component.successMessage()).toBeTruthy();
    expect(component.form.value.first_name).toBeFalsy();
  });

  it('shows error message on adminCreateProfile failure', async () => {
    mockService['adminCreateProfile'] = vi.fn().mockRejectedValue(new Error('DB error'));
    component.form.setValue({
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
    });
    await component.onSubmit();
    expect(component.errorMessage()).toContain('DB error');
  });
});
