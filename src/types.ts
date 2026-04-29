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
  // Aggregated data
  total_duration?: number;
  end_time?: string;
  topics_count?: number;
  participants_count?: number;
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
  participant_id?: string;
  participant_name?: string;
  meeting_participant_id: string;
  role: 'required' | 'optional';
  created_at?: string;
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  name: string;
  email?: string | null;
  created_at: string;
}

export interface MeetingExecutionLog {
  id: string;
  meeting_id: string;
  topic_id: string;
  topic_type: 'topic' | 'break';
  planned_duration: number;
  actual_duration: number;
  exceeded_time: number;
  started_at: string;
  ended_at: string;
  skipped?: boolean;
  time_adjustments?: number;
  adjustment_count?: number;
}

export type AgendaItem = (Topic | Break) & { type: 'topic' | 'break' };
