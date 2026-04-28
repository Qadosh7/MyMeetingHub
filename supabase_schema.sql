-- SQL Schema for Agenda Inteligente de Reuniões

-- 1. Meetings Table
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planning',
    event_date DATE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure newest columns exist if table was created earlier
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meetings' AND column_name='status') THEN
        ALTER TABLE meetings ADD COLUMN status TEXT NOT NULL DEFAULT 'planning';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meetings' AND column_name='event_date') THEN
        ALTER TABLE meetings ADD COLUMN event_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meetings' AND column_name='start_time') THEN
        ALTER TABLE meetings ADD COLUMN start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meetings' AND column_name='updated_at') THEN
        ALTER TABLE meetings ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meetings' AND column_name='last_accessed') THEN
        ALTER TABLE meetings ADD COLUMN last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meetings' AND column_name='is_favorite') THEN
        ALTER TABLE meetings ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meetings' AND column_name='tags') THEN
        ALTER TABLE meetings ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- 2. Participants Table (Global List)
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Topics Table
CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    order_index INTEGER NOT NULL DEFAULT 0,
    presenter_id UUID REFERENCES meeting_participants(id) ON DELETE SET NULL,
    presenter_name TEXT
);

-- Migrating old data if necessary
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='topics' AND column_name='presenter_id') THEN
        ALTER TABLE topics ADD COLUMN presenter_id UUID REFERENCES meeting_participants(id) ON DELETE SET NULL;
    ELSE
        -- Update foreign key if it was pointing elsewhere
        BEGIN
            ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_presenter_id_fkey;
            ALTER TABLE topics ADD CONSTRAINT topics_presenter_id_fkey FOREIGN KEY (presenter_id) REFERENCES meeting_participants(id) ON DELETE SET NULL;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore if we can't change FK easily in this env
        END;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='topics' AND column_name='presenter_name') THEN
        ALTER TABLE topics ADD COLUMN presenter_name TEXT;
    END IF;
END $$;

-- 4. Topic Participants Table (Junction with name fallback)
CREATE TABLE IF NOT EXISTS topic_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
    participant_name TEXT NOT NULL
);

-- Ensure new columns exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='topic_participants' AND column_name='participant_id') THEN
        ALTER TABLE topic_participants ADD COLUMN participant_id UUID REFERENCES participants(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Breaks Table
CREATE TABLE IF NOT EXISTS breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Pausa',
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    order_index INTEGER NOT NULL DEFAULT 0
);

-- 6. Meeting Execution Logs Table
CREATE TABLE IF NOT EXISTS meeting_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL, -- references either topics.id or breaks.id
    topic_type TEXT NOT NULL, -- 'topic' or 'break'
    planned_duration INTEGER NOT NULL,
    actual_duration NUMERIC NOT NULL,
    exceeded_time NUMERIC NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure newest columns exist in meeting_execution_logs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meeting_execution_logs' AND column_name='skipped') THEN
        ALTER TABLE meeting_execution_logs ADD COLUMN skipped BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meeting_execution_logs' AND column_name='time_adjustments') THEN
        ALTER TABLE meeting_execution_logs ADD COLUMN time_adjustments INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meeting_execution_logs' AND column_name='adjustment_count') THEN
        ALTER TABLE meeting_execution_logs ADD COLUMN adjustment_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 7. Meeting Participants Table
CREATE TABLE IF NOT EXISTS meeting_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update Topic Participants
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='topic_participants' AND column_name='meeting_participant_id') THEN
        ALTER TABLE topic_participants ADD COLUMN meeting_participant_id UUID REFERENCES meeting_participants(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='topic_participants' AND column_name='role') THEN
        ALTER TABLE topic_participants ADD COLUMN role TEXT NOT NULL DEFAULT 'optional';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='topic_participants' AND column_name='created_at') THEN
        ALTER TABLE topic_participants ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    -- Make participant_name nullable
    ALTER TABLE topic_participants ALTER COLUMN participant_name DROP NOT NULL;
END $$;

-- Row Level Security (RLS)

-- Meetings
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage their own meetings" ON meetings;
    CREATE POLICY "Users can manage their own meetings" ON meetings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
END $$;

-- Participants
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage their own participant list" ON participants;
    CREATE POLICY "Users can manage their own participant list" ON participants FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
END $$;

-- Topics
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage topics of their meetings" ON topics;
    CREATE POLICY "Users can manage topics of their meetings" ON topics FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM meetings WHERE meetings.id = topics.meeting_id AND meetings.user_id = auth.uid()));
END $$;

-- Topic Participants
ALTER TABLE topic_participants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage topic participants" ON topic_participants;
    CREATE POLICY "Users can manage topic participants" ON topic_participants FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM topics JOIN meetings ON meetings.id = topics.meeting_id WHERE topics.id = topic_participants.topic_id AND meetings.user_id = auth.uid()));
END $$;

-- Breaks
ALTER TABLE breaks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage breaks" ON breaks;
    CREATE POLICY "Users can manage breaks" ON breaks FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM meetings WHERE meetings.id = breaks.meeting_id AND meetings.user_id = auth.uid()));
END $$;

-- Execution Logs
ALTER TABLE meeting_execution_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage execution logs" ON meeting_execution_logs;
    CREATE POLICY "Users can manage execution logs" ON meeting_execution_logs FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_execution_logs.meeting_id AND meetings.user_id = auth.uid()));
END $$;

-- Meeting Participants
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage meeting participants" ON meeting_participants;
    CREATE POLICY "Users can manage meeting participants" ON meeting_participants FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_participants.meeting_id AND meetings.user_id = auth.uid()));
END $$;

-- Topic Participants (Updated RLS already exists but we ensure it works with meeting_id check if needed)
-- The existing rule uses topic_id -> meetings, which is still correct.
