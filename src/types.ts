export interface Meeting {
  id: string;
  user_id: string;
  title: string;
  event_date?: string | null;
  created_at: string;
  updated_at?: string;
  last_accessed?: string;
  is_favorite?: boolean;
  status?: 'planning' | 'in_progress' | 'completed';
  tags?: string[];
  start_time?: string | null;
  topics?: (Topic & { topic_participants?: { participant_id: string, participant_name: string }[] })[];
  breaks?: Break[];
}

export interface Participant {
  id: string;
  user_id: string;
  name: string;
  email?: string | null;
}

export interface Topic {
  id: string;
  meeting_id: string;
  title: string;
  duration_minutes: number;
  order_index: number;
  presenter_id: string | null;
  presenter_name: string | null;
  type: 'topic';
}

export interface Break {
  id: string;
  meeting_id: string;
  title: string;
  duration_minutes: number;
  order_index: number;
  type: 'break';
}

export interface TopicParticipant {
  id: string;
  topic_id: string;
  participant_id: string;
  participant_name: string;
}

export type AgendaItem = (Topic | Break) & { type: 'topic' | 'break' };
