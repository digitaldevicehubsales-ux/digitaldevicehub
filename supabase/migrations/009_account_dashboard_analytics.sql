-- PostgreSQL requires a newly-added enum value to be committed before later
-- migrations can reference it in policies or data changes.
alter type public.listing_status add value if not exists 'paused';
