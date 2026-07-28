import { describe, it, expect } from 'vitest'
import { calculateRewards, getMaxDiscountCap } from '../rewardEngine'
import type { ReferralRewardRule, RewardContext } from '../types'

// ─── Factory helpers ──────────────────────────────────────────────────────────

function makeRule(overrides: Partial<ReferralRewardRule> = {}): ReferralRewardRule {
  return {
    id: 'rule-1',
    tenant: 'test-tenant',
    rule_type: 'referrer',
    reward_type: 'fixed_amount',
    reward_value: 5000,
    duration_cycles: 3,
    pack_size: 1,
    max_discount_per_cycle: 20000,
    volume_target: null,
    volume_period: null,
    volume_reward_description: null,
    sort_order: 0,
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeContext(overrides: Partial<RewardContext> = {}): RewardContext {
  return {
    isNewReferral: true,
    referrerMonthlyCount: 0,
    referrerWeeklyCount: 0,
    referrerQuarterlyCount: 0,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('calculateRewards', () => {
  it('returns empty rewards when isNewReferral is false', () => {
    const rules = [makeRule()]
    const ctx = makeContext({ isNewReferral: false })
    const result = calculateRewards(rules, ctx)

    expect(result.rewards).toHaveLength(0)
    expect(result.volume_goal_reached).toBe(false)
  })

  it('returns reward for referrer rule', () => {
    const rules = [makeRule({ rule_type: 'referrer', reward_value: 5000 })]
    const ctx = makeContext()
    const result = calculateRewards(rules, ctx)

    expect(result.rewards).toHaveLength(1)
    expect(result.rewards[0].target).toBe('referrer')
    expect(result.rewards[0].value).toBe(5000)
    expect(result.rewards[0].duration_cycles).toBe(3)
  })

  it('returns reward for referred_new rule', () => {
    const rules = [makeRule({ rule_type: 'referred_new', reward_value: 3000 })]
    const ctx = makeContext()
    const result = calculateRewards(rules, ctx)

    expect(result.rewards).toHaveLength(1)
    expect(result.rewards[0].target).toBe('referred')
    expect(result.rewards[0].value).toBe(3000)
  })

  it('applies multiple rules simultaneously', () => {
    const rules = [
      makeRule({ id: 'r1', rule_type: 'referrer', reward_value: 5000 }),
      makeRule({ id: 'r2', rule_type: 'referred_new', reward_value: 5000 }),
    ]
    const ctx = makeContext()
    const result = calculateRewards(rules, ctx)

    expect(result.rewards).toHaveLength(2)
    expect(result.rewards.find(r => r.target === 'referrer')).toBeDefined()
    expect(result.rewards.find(r => r.target === 'referred')).toBeDefined()
  })

  it('skips inactive rules', () => {
    const rules = [
      makeRule({ is_active: false, reward_value: 99999 }),
    ]
    const ctx = makeContext()
    const result = calculateRewards(rules, ctx)

    expect(result.rewards).toHaveLength(0)
  })

  it('triggers volume goal when monthly count reaches target', () => {
    const rules = [
      makeRule({
        id: 'vol',
        rule_type: 'volume_goal',
        reward_type: 'free_session',
        volume_target: 5,
        volume_period: 'monthly',
        volume_reward_description: 'Sesión gratuita',
      }),
    ]
    // User currently has 4 referrals this month; this new one makes 5
    const ctx = makeContext({ referrerMonthlyCount: 4 })
    const result = calculateRewards(rules, ctx)

    expect(result.volume_goal_reached).toBe(true)
    expect(result.volume_reward_description).toBe('Sesión gratuita')
  })

  it('does NOT trigger volume goal when count is below target', () => {
    const rules = [
      makeRule({
        rule_type: 'volume_goal',
        volume_target: 5,
        volume_period: 'monthly',
      }),
    ]
    const ctx = makeContext({ referrerMonthlyCount: 2 })
    const result = calculateRewards(rules, ctx)

    expect(result.volume_goal_reached).toBe(false)
  })

  it('uses weekly count for weekly period', () => {
    const rules = [
      makeRule({
        rule_type: 'volume_goal',
        volume_target: 3,
        volume_period: 'weekly',
      }),
    ]
    const ctx = makeContext({ referrerWeeklyCount: 2 })
    const result = calculateRewards(rules, ctx)

    expect(result.volume_goal_reached).toBe(true)
  })

  it('uses quarterly count for quarterly period', () => {
    const rules = [
      makeRule({
        rule_type: 'volume_goal',
        volume_target: 10,
        volume_period: 'quarterly',
      }),
    ]
    const ctx = makeContext({ referrerQuarterlyCount: 9 })
    const result = calculateRewards(rules, ctx)

    expect(result.volume_goal_reached).toBe(true)
  })

  it('handles percentage reward type description', () => {
    const rules = [
      makeRule({ reward_type: 'percentage', reward_value: 15, duration_cycles: 2 }),
    ]
    const ctx = makeContext()
    const result = calculateRewards(rules, ctx)

    expect(result.rewards[0].description).toContain('15%')
    expect(result.rewards[0].description).toContain('2 ciclo(s)')
  })

  it('handles free_session reward type', () => {
    const rules = [
      makeRule({ reward_type: 'free_session' }),
    ]
    const ctx = makeContext()
    const result = calculateRewards(rules, ctx)

    expect(result.rewards[0].description).toBe('Sesión gratuita')
  })

  it('returns applied_at timestamp', () => {
    const rules = [makeRule()]
    const ctx = makeContext()
    const result = calculateRewards(rules, ctx)

    expect(result.applied_at).toBeDefined()
    expect(new Date(result.applied_at).getTime()).toBeGreaterThan(0)
  })
})

describe('getMaxDiscountCap', () => {
  it('returns the highest cap from active rules', () => {
    const rules = [
      makeRule({ id: 'a', max_discount_per_cycle: 15000, is_active: true }),
      makeRule({ id: 'b', max_discount_per_cycle: 20000, is_active: true }),
      makeRule({ id: 'c', max_discount_per_cycle: 25000, is_active: false }),
    ]
    expect(getMaxDiscountCap(rules)).toBe(20000)
  })

  it('returns 0 when no rules have a cap', () => {
    const rules = [
      makeRule({ max_discount_per_cycle: 0 }),
    ]
    expect(getMaxDiscountCap(rules)).toBe(0)
  })

  it('returns 0 for empty rules array', () => {
    expect(getMaxDiscountCap([])).toBe(0)
  })
})
