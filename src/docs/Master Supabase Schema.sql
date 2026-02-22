-- ==========================================
-- 1. PROFILES TABLE
-- ==========================================
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    email TEXT UNIQUE CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'), 
    phone TEXT UNIQUE CHECK (phone ~ '^\+[1-9]\d{1,14}$'),
    is_admin BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    registration_complete BOOLEAN DEFAULT FALSE, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. GROWTH DATA TABLE
-- ==========================================
CREATE TABLE public.growth_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email_key TEXT NOT NULL CHECK (email_key ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'), 
    bank_name TEXT NOT NULL,
    is_managed BOOLEAN DEFAULT FALSE, 
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    growth_pct DECIMAL(5,2) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_growth_email_key ON public.growth_data(email_key);
CREATE INDEX idx_growth_user_id ON public.growth_data(user_id);
CREATE INDEX idx_growth_date ON public.growth_data(year, month);

-- ==========================================
-- 3. MARKET INDEXES TABLE
-- ==========================================
CREATE TABLE public.market_indexes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    index_name TEXT NOT NULL, 
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    growth_pct DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_date ON public.market_indexes(year, month);

-- ==========================================
-- 4. AUDIT LOGS TABLE
-- ==========================================
CREATE TABLE public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    performed_by UUID REFERENCES auth.users(id),
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ==========================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_indexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER bypasses RLS, breaking recursive policy loops)
CREATE OR REPLACE FUNCTION public.is_registered()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND registration_complete = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$;

CREATE POLICY "Registered users can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_registered());

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admin can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_admin_user());

CREATE POLICY "Users can insert own profile during auth"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Registered users can view all growth data"
ON public.growth_data FOR SELECT
TO authenticated
USING (public.is_registered());

CREATE POLICY "Users can manage own growth data"
ON public.growth_data FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can manage growth data"
ON public.growth_data FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

CREATE POLICY "Registered users can view market indexes"
ON public.market_indexes FOR SELECT
TO authenticated
USING (public.is_registered());

CREATE POLICY "Admin can manage market indexes"
ON public.market_indexes FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Requirement: Audit logs visible to any authenticated user
CREATE POLICY "Authenticated users can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (true);

-- ==========================================
-- 6. FUNCTIONS & TRIGGERS
-- ==========================================

-- AUDIT LOG TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, performed_by, old_data)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, auth.uid(), to_jsonb(OLD));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, performed_by, old_data, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, performed_by, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, auth.uid(), to_jsonb(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

-- Apply Audit Triggers
CREATE TRIGGER audit_profiles_trigger AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();
CREATE TRIGGER audit_growth_data_trigger AFTER INSERT OR UPDATE OR DELETE ON public.growth_data FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();
CREATE TRIGGER audit_market_indexes_trigger AFTER INSERT OR UPDATE OR DELETE ON public.market_indexes FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- Standard Utility Functions
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, phone) 
    VALUES (new.id, LOWER(TRIM(new.email)), new.phone);
    RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.complete_registration(p_first_name TEXT, p_last_name TEXT, p_phone TEXT, p_email TEXT, p_invitation_code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
    v_email TEXT;
    v_claimed_count INTEGER;
BEGIN
    -- Validate invitation code
    IF p_invitation_code != 'Fruehling' THEN 
        RAISE EXCEPTION 'Invalid invitation code.'; 
    END IF;
    
    -- Get the email to use for matching (normalize to lowercase)
    SELECT COALESCE(profiles.email, LOWER(TRIM(p_email))) INTO v_email 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    -- Lock and claim growth_data rows atomically
    WITH claimed_rows AS (
        UPDATE public.growth_data 
        SET user_id = auth.uid() 
        WHERE email_key = v_email 
          AND user_id IS NULL
        RETURNING id
    )
    SELECT COUNT(*) INTO v_claimed_count FROM claimed_rows;
    
    -- Update profile with registration details
    UPDATE public.profiles 
    SET 
        first_name = p_first_name, 
        last_name = p_last_name, 
        phone = COALESCE(profiles.phone, p_phone), 
        email = v_email, 
        registration_complete = true
    WHERE id = auth.uid();
    
    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_verification_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.profiles 
    SET 
        email_verified = (new.email_confirmed_at IS NOT NULL), 
        phone_verified = (new.phone_confirmed_at IS NOT NULL), 
        email = COALESCE(LOWER(TRIM(new.email)), profiles.email), 
        phone = COALESCE(new.phone, profiles.phone) 
    WHERE id = new.id;
    RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_updated AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.sync_verification_status();

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER on_growth_data_trigger_update BEFORE UPDATE ON public.growth_data FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER on_market_index_update BEFORE UPDATE ON public.market_indexes FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();