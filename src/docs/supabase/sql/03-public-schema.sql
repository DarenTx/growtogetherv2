-- Name: complete_registration(text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.complete_registration(p_first_name text, p_last_name text, p_work_email text, p_personal_email text, p_invitation_code text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE 
    v_work_email TEXT;
    v_personal_email TEXT;
    v_claimed_count INTEGER;
BEGIN
    -- Validate invitation code
    IF p_invitation_code != 'Fruehling' THEN 
        RAISE EXCEPTION 'Invalid invitation code.'; 
    END IF;
    
    -- Get the work email to use for matching historical growth data.
    SELECT COALESCE(profiles.work_email, LOWER(TRIM(p_work_email))) INTO v_work_email 
    FROM public.profiles 
    WHERE id = auth.uid();

    v_personal_email := LOWER(TRIM(p_personal_email));
    
    -- Lock and claim growth_data rows atomically
    WITH claimed_rows AS (
        UPDATE public.growth_data 
        SET user_id = auth.uid() 
                WHERE email_key = v_work_email 
          AND user_id IS NULL
        RETURNING id
    )
    SELECT COUNT(*) INTO v_claimed_count FROM claimed_rows;
    
    -- Update profile with registration details
    UPDATE public.profiles 
    SET 
        first_name = p_first_name, 
        last_name = p_last_name, 
        work_email = v_work_email,
        personal_email = v_personal_email,
        personal_email_verified = CASE
            WHEN profiles.personal_email IS NOT DISTINCT FROM v_personal_email
                THEN COALESCE(profiles.personal_email_verified, false)
            ELSE false
        END,
        registration_complete = true
    WHERE id = auth.uid();
    
    RETURN true;
END;
$$;


ALTER FUNCTION public.complete_registration(p_first_name text, p_last_name text, p_work_email text, p_personal_email text, p_invitation_code text) OWNER TO postgres;

--
-- Name: get_audit_log_page(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_audit_log_page(p_offset integer, p_limit integer) RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM public.audit_logs),
    'rows', (
      SELECT json_agg(r)
      FROM (
        SELECT
          al.id,
          al.table_name,
          al.record_id,
          al.action,
          al.performed_by,
          p.first_name  AS performer_first_name,
          p.last_name   AS performer_last_name,
          al.old_data,
          al.new_data,
          al.created_at
        FROM public.audit_logs al
        LEFT JOIN public.profiles p ON p.id = al.performed_by
        ORDER BY al.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) r
    )
  );
$$;


ALTER FUNCTION public.get_audit_log_page(p_offset integer, p_limit integer) OWNER TO postgres;

--
-- Name: handle_new_auth_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.profiles (id, personal_email, personal_email_verified)
    VALUES (
        new.id,
        LOWER(TRIM(new.email)),
        (new.email_confirmed_at IS NOT NULL)
    )
    ON CONFLICT (id) DO UPDATE
    SET
        personal_email = EXCLUDED.personal_email,
        personal_email_verified = EXCLUDED.personal_email_verified;
    RETURN new;
END;
$$;


ALTER FUNCTION public.handle_new_auth_user() OWNER TO postgres;

--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.handle_updated_at() OWNER TO postgres;

--
-- Name: is_admin_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_admin_user() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$;


ALTER FUNCTION public.is_admin_user() OWNER TO postgres;

--
-- Name: is_registered(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_registered() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND registration_complete = true
  );
$$;


ALTER FUNCTION public.is_registered() OWNER TO postgres;

--
-- Name: process_audit_log(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.process_audit_log() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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


ALTER FUNCTION public.process_audit_log() OWNER TO postgres;

--
-- Name: sync_verification_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_verification_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.profiles 
    SET 
        personal_email_verified = (new.email_confirmed_at IS NOT NULL), 
        personal_email = COALESCE(LOWER(TRIM(new.email)), profiles.personal_email)
    WHERE id = new.id;
    RETURN new;
END;
$$;


ALTER FUNCTION public.sync_verification_status() OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL,
    performed_by uuid,
    old_data jsonb,
    new_data jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: growth_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.growth_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_key text NOT NULL,
    bank_name text NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    growth_pct numeric(5,2) NOT NULL,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT growth_data_email_key_format_check CHECK ((email_key ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)),
    CONSTRAINT growth_data_month_check CHECK (((month >= 1) AND (month <= 12)))
);


ALTER TABLE public.growth_data OWNER TO postgres;

--
-- Name: market_indexes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.market_indexes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    index_name text NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    growth_pct numeric(5,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT market_indexes_month_check CHECK (((month >= 1) AND (month <= 12)))
);


ALTER TABLE public.market_indexes OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name text,
    last_name text,
    work_email text,
    personal_email text,
    work_email_verified boolean DEFAULT false,
    personal_email_verified boolean DEFAULT false,
    registration_complete boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_admin boolean DEFAULT false,
    CONSTRAINT profiles_personal_email_format_check CHECK (((personal_email IS NULL) OR (personal_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text))),
    CONSTRAINT profiles_work_email_format_check CHECK (((work_email IS NULL) OR (work_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)))
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: person_bank_list; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.person_bank_list AS
SELECT DISTINCT ON (gd.user_id, gd.bank_name)
    gd.user_id,
    gd.bank_name,
    p.first_name,
    p.last_name
FROM public.growth_data gd
JOIN public.profiles p ON p.id = gd.user_id
WHERE gd.user_id IS NOT NULL
ORDER BY gd.user_id, gd.bank_name;


ALTER VIEW public.person_bank_list OWNER TO postgres;

--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: growth_data growth_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.growth_data
    ADD CONSTRAINT growth_data_pkey PRIMARY KEY (id);


--
-- Name: market_indexes market_indexes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_indexes
    ADD CONSTRAINT market_indexes_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_work_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_work_email_key UNIQUE (work_email);


--
-- Name: growth_data uq_growth_data_natural_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.growth_data
    ADD CONSTRAINT uq_growth_data_natural_key UNIQUE (email_key, bank_name, year, month);


--
-- Name: market_indexes uq_market_indexes_natural_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_indexes
    ADD CONSTRAINT uq_market_indexes_natural_key UNIQUE (index_name, year, month);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_growth_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_growth_date ON public.growth_data USING btree (year, month);


--
-- Name: idx_growth_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_growth_email_key ON public.growth_data USING btree (email_key);


--
-- Name: idx_growth_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_growth_user_id ON public.growth_data USING btree (user_id);


--
-- Name: idx_market_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_market_date ON public.market_indexes USING btree (year, month);


--
-- Name: growth_data audit_growth_data_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_growth_data_trigger AFTER INSERT OR DELETE OR UPDATE ON public.growth_data FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();


--
-- Name: market_indexes audit_market_indexes_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_market_indexes_trigger AFTER INSERT OR DELETE OR UPDATE ON public.market_indexes FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();


--
-- Name: profiles audit_profiles_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_profiles_trigger AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();


--
-- Name: growth_data on_growth_data_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_growth_data_update BEFORE UPDATE ON public.growth_data FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: market_indexes on_market_index_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_market_index_update BEFORE UPDATE ON public.market_indexes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: profiles on_profile_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_profile_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: audit_logs audit_logs_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES auth.users(id);


--
-- Name: growth_data growth_data_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.growth_data
    ADD CONSTRAINT growth_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profiles Admin can insert profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());


--
-- Name: growth_data Admin can manage growth data; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin can manage growth data" ON public.growth_data TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());


--
-- Name: market_indexes Admin can manage market indexes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin can manage market indexes" ON public.market_indexes TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());


--
-- Name: profiles Admin can update any profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin_user());


--
-- Name: audit_logs Authenticated users can view audit logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);


--
-- Name: growth_data Registered users can view all growth data; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Registered users can view all growth data" ON public.growth_data FOR SELECT TO authenticated USING (public.is_registered());


--
-- Name: profiles Registered users can view all profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Registered users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_registered());


--
-- Name: market_indexes Registered users can view market indexes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Registered users can view market indexes" ON public.market_indexes FOR SELECT TO authenticated USING (public.is_registered());


--
-- Name: growth_data Users can manage own growth data; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own growth data" ON public.growth_data TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: growth_data; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.growth_data ENABLE ROW LEVEL SECURITY;

--
-- Name: market_indexes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.market_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
