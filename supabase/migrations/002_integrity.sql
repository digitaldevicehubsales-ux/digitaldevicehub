-- Additional integrity protections for the DigitalDeviceHub MVP.

-- Prevent duplicate buyer/seller conversations for the same listing.
create unique index if not exists conversations_unique_listing_participants_idx
on public.conversations(listing_id, buyer_id, seller_id)
where listing_id is not null;

-- Useful inbox and moderation indexes while remaining within the free-tier database.
create index if not exists messages_sender_created_idx
on public.messages(sender_id, created_at desc);

create index if not exists listings_moderation_idx
on public.listings(status, created_at asc)
where status in ('pending','rejected');
