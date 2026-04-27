-- SQL Schema for Agenda Inteligente de Reuniões

-- 1. Meetings Table
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Topics Table
CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    order_index INTEGER NOT NULL DEFAULT 0,
    presenter TEXT
);

-- Ensure presenter column exists if table was created earlier without it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='topics' AND column_name='presenter') THEN
        ALTER TABLE topics ADD COLUMN presenter TEXT;
    END IF;
END $$;

-- 3. Topic Participants Table
CREATE TABLE IF NOT EXISTS topic_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    participant_name TEXT NOT NULL
);

-- Ensure correct column name exists and rename if necessary
DO $$
BEGIN
    -- If 'name' exists but 'participant_name' doesn't, rename it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='topic_participants' AND column_name='name') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='topic_participants' AND column_name='participant_name') THEN
        ALTER TABLE topic_participants RENAME COLUMN name TO participant_name;
    END IF;

    -- Final check to ensure participant_name exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='topic_participants' AND column_name='participant_name') THEN
        ALTER TABLE topic_participants ADD COLUMN participant_name TEXT NOT NULL DEFAULT '';
    END IF;
END $$;

-- 4. Breaks Table
CREATE TABLE IF NOT EXISTS breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Pausa',
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    order_index INTEGER NOT NULL DEFAULT 0
);

-- Ensure title column exists in breaks
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='breaks' AND column_name='title') THEN
        ALTER TABLE breaks ADD COLUMN title TEXT NOT NULL DEFAULT 'Pausa';
    END IF;
END $$;

-- Row Level Security (RLS)

-- Meetings
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage their own meetings" ON meetings;
END $$;

CREATE POLICY "Users can manage their own meetings"
ON meetings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Topics
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage topics of their meetings" ON topics;
END $$;

CREATE POLICY "Users can manage topics of their meetings"
ON topics FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM meetings
        WHERE meetings.id = topics.meeting_id
        AND meetings.user_id = auth.uid()
    )
);

-- Topic Participants
ALTER TABLE topic_participants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage participants of their topics" ON topic_participants;
END $$;

CREATE POLICY "Users can manage participants of their topics"
ON topic_participants FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM topics
        JOIN meetings ON meetings.id = topics.meeting_id
        WHERE topics.id = topic_participants.topic_id
        AND meetings.user_id = auth.uid()
    )
);

-- Breaks
ALTER TABLE breaks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage breaks of their meetings" ON breaks;
END $$;

CREATE POLICY "Users can manage breaks of their meetings"
ON breaks FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM meetings
        WHERE meetings.id = breaks.meeting_id
        AND meetings.user_id = auth.uid()
    )
);
