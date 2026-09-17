-- Adds the 'other' category so games can be tagged outside the original
-- 22-critical-risk / 7-life-saving-rules split.
alter table public.safety_games drop constraint if exists safety_games_category_check;
alter table public.safety_games add constraint safety_games_category_check
  check (category in ('critical_risk_22', 'life_rules_7', 'other'));
