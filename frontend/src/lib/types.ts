export interface Author {
  id: string
  display_name: string
  avatar_url: string | null
}

export interface Plate {
  id: string
  image_url: string
  image_thumb_url: string
  plate_text: string
  state_code: string
  state_name: string
  author: Author | null
  score: number
  upvotes: number
  downvotes: number
  user_vote: 1 | -1 | 0
  comment_count: number
  caption?: string
  created_at: string
  status?: 'approved' | 'rejected'
  rejection_reason?: string
}

export interface PlateDetail extends Plate {
  related_plates: Plate[]
  comments_enabled: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  next_cursor: string | null
}

export interface StateSummary {
  code: string
  name: string
  plate_count: number
  top_plate_id: string | null
}

export interface MapSummaryResponse {
  states: StateSummary[]
}

export interface StateDetail {
  state: { code: string; name: string }
  hero_plate: Plate | null
  top_10: Plate[]
  total_count: number
}

export interface LeaderboardResponse {
  items: Plate[]
  window: string
  generated_at: string
}

export interface VoteResponse {
  score: number
  upvotes: number
  downvotes: number
  user_vote: 1 | -1 | 0
}

export interface UploadSignResponse {
  upload_token: string
  signed_url: string
  object_path: string
  expires_at: string
}

export interface OcrHintResponse {
  plate_text_guess: string | null
  confidence: number
}

export interface Comment {
  id: string
  plate_id: string
  author: Author
  body: string
  created_at: string
}

export interface UserProfile {
  id: string
  email: string | null
  display_name: string
  avatar_url: string | null
  created_at: string
}

export interface UserVote {
  plate: Plate
  value: 1 | -1
  voted_at: string
}
