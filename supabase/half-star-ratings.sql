alter table public.shared_library_items
  drop constraint if exists shared_library_items_rating_check;

alter table public.shared_library_items
  alter column rating type numeric(2, 1)
  using rating::numeric;

alter table public.shared_library_items
  add constraint shared_library_items_rating_check
  check (
    rating is null or (
      rating between 0.5 and 5
      and rating * 2 = trunc(rating * 2)
    )
  );
