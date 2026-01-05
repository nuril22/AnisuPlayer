export interface VideoSource {
  id: number;
  resolution: string;
  url: string;
  is_local: boolean;
  file_size?: number;
}

export interface Subtitle {
  id: number;
  label: string;
  language: string;
  url: string;
  is_default: boolean;
}

export interface Video {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  sources: VideoSource[];
  subtitles: Subtitle[];
  created_at: string;
  updated_at: string;
}

export interface EncodingJob {
  id: string;
  video_id: string;
  video_title: string;
  status: 'pending' | 'encoding' | 'completed' | 'failed';
  progress: number;
  current_resolution?: string;
  resolutions_completed: string[];
  resolutions_pending: string[];
  started_at?: string;
  completed_at?: string;
  estimated_time_remaining?: number;
  error?: string;
}

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  action?: () => void;
  divider?: boolean;
  disabled?: boolean;
}

export interface PlayerSettings {
  playbackSpeed: number;
  quality: string;
  subtitleId: number | null;
  volume: number;
  muted: boolean;
}

