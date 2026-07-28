// Matches referral_settings table
export type ReferralSettings = {
  id: string
  tenant: string
  platform_enabled: boolean
  tenant_enabled: boolean
  display_name: string
  icon: string
  reader_role_enabled: boolean
  discount_codes_module_enabled: boolean
  discount_codes_display_name: string
  show_rewards_to_user: boolean
  show_referral_count_to_user: boolean
  created_at: string
  updated_at: string
}

// Matches referral_reward_rules table
export type RuleType = 'referred_new' | 'referrer' | 'volume_goal'
export type RewardType = 'fixed_amount' | 'percentage' | 'free_session' | 'custom'
export type VolumePeriod = 'weekly' | 'monthly' | 'quarterly'

export type ReferralRewardRule = {
  id: string
  tenant: string
  rule_type: RuleType
  reward_type: RewardType
  reward_value: number
  duration_cycles: number
  pack_size: number
  max_discount_per_cycle: number
  volume_target: number | null
  volume_period: VolumePeriod | null
  volume_reward_description: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// Matches user_referral_codes table
export type UserReferralCode = {
  id: string
  user_id: string
  tenant: string
  code: string
  created_at: string
}

// Matches discount_codes table
export type DiscountCode = {
  id: string
  tenant: string
  code: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  manual_override: boolean | null
  reward_rule_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// Matches referral_usages table
export type ReferralUsage = {
  id: string
  tenant: string
  referred_user_id: string
  user_referral_code_id: string | null
  discount_code_id: string | null
  used_at: string
  rewards_applied: RewardsApplied
}

// Reward calculation output
export type SingleReward = {
  target: 'referred' | 'referrer'
  type: RewardType
  value: number
  duration_cycles: number
  pack_size: number
  description: string
}

export type RewardsApplied = {
  rewards: SingleReward[]
  volume_goal_reached: boolean
  volume_reward_description?: string
  applied_at: string
}

// Context for reward calculation
export type RewardContext = {
  isNewReferral: boolean      // whether there is a new referred user
  referrerMonthlyCount: number  // how many referrals referrer has this period
  referrerWeeklyCount: number
  referrerQuarterlyCount: number
}

// DTO for admin views — user code with owner info
export type UserReferralCodeWithOwner = UserReferralCode & {
  owner: {
    id: string
    nombre: string
    apellido: string
    email: string
    rol: string
    avatar_url: string | null
  }
  referral_count: number
}

// DTO for usage tracking with enriched info
export type ReferralUsageEnriched = ReferralUsage & {
  referred_user: {
    id: string
    nombre: string
    apellido: string
    email: string
    rol: string
  }
  referrer_code?: string
  referrer_user?: {
    id: string
    nombre: string
    apellido: string
  } | null
  discount_code?: string | null
}

// Icon options available for the referral system button
export const REFERRAL_ICON_OPTIONS = [
  { value: 'gift', label: 'Regalo' },
  { value: 'star', label: 'Estrella' },
  { value: 'zap', label: 'Rayo' },
  { value: 'share-2', label: 'Compartir' },
  { value: 'award', label: 'Premio' },
  { value: 'heart', label: 'Corazón' },
  { value: 'trophy', label: 'Trofeo' },
  { value: 'users', label: 'Usuarios' },
] as const

export type ReferralIconOption = typeof REFERRAL_ICON_OPTIONS[number]['value']
