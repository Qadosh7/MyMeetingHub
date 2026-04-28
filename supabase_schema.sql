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
    presenter_id UUID REFERENCES participants(id) ON DELETE SET NULL,
    presenter_name TEXT
);

-- Migrating old data if necessary
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='topics' AND column_name='presenter_id') THEN
        ALTER TABLE topics ADD COLUMN presenter_id UUID REFERENCES participants(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='topics' AND column_name='presenter_name') THEN
        ALTER TABLE topics ADD COLUMN presenter_name TEXT;
    END IF;
    -- If old 'presenter' column exists, we can keep it for legacy or rename
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
