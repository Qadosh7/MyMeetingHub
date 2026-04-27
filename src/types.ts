export interface Meeting {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
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
