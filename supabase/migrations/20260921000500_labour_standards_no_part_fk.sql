-- Labour standards exist for cabling and service part numbers that are not in the
-- equipment price book, so the FK to parts is dropped.
alter table public.labour_standards drop constraint if exists labour_standards_part_number_fkey;
