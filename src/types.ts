export interface Meeting {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  status?: 'planning' | 'in_progress' | 'completed';
  topics?: (Topic & { topic_participants?: { participant_name: string }[] })[];
  breaks?: Break[];
}

export interface Topic {
  id: string;
  meeting_id: string;
  title: string;
  duration_minutes: number;
  order_index: number;
  presenter: string | null;
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
  participant_name: string;
}

export type AgendaItem = (Topic | Break) & { type: 'topic' | 'break' };
