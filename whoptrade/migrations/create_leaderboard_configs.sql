-- Migration: Drop leaderboard_configs table
-- This table is no longer needed as we're using Whop's leaderboard features

DROP TABLE IF EXISTS leaderboard_configs CASCADE;