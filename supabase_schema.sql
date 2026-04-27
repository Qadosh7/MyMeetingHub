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

-- 3. Topic Participants Table
CREATE TABLE IF NOT EXISTS topic_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    name TEXT NOT NULL
);

-- 4. Breaks Table
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

CREATE POLICY "Allow all for now"
ON meetings
FOR ALL
USING (true)
WITH CHECK (true);

-- Topics
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

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
