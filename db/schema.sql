-- Mess Manager schema. Money is stored as integer paisa (1 tk = 100 paisa).
-- Safe to run more than once.

create table if not exists messes (
  id          serial primary key,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists members (
  id             serial primary key,
  mess_id        int not null references messes(id) on delete cascade,
  name           text not null,
  phone          text unique,   -- login id (digits only, e.g. 01712345678)
  email          text,
  password_hash  text,
  role           text not null default 'member' check (role in ('manager','member')),
  status         text not null default 'active' check (status in ('active','deactivated','left')),
  invite_code    text unique,
  joined_on      date not null default current_date,
  created_at     timestamptz not null default now()
);
create index if not exists members_mess_idx on members(mess_id);

-- Per-month settings. A row only exists once the manager sets something or closes the month.
create table if not exists months (
  mess_id         int not null references messes(id) on delete cascade,
  ym              text not null check (ym ~ '^\d{4}-\d{2}$'),
  meal_deposit    int not null default 0,
  closed          boolean not null default false,
  closed_at       timestamptz,
  primary key (mess_id, ym)
);

-- Every cost. kind decides how it is split:
--   rent, bill, staple, other: equally among the members the manager picked (custom amounts allowed)
--   bazar: by meals eaten on spent_on
create table if not exists expenses (
  id            serial primary key,
  mess_id       int not null references messes(id) on delete cascade,
  kind          text not null check (kind in ('rent','bill','staple','bazar','other')),
  title         text not null,
  items         text,
  amount        int not null check (amount > 0),
  spent_on      date not null,
  bought_by     int references members(id),
  note          text,
  receipt       bytea,
  receipt_type  text,
  created_by    int references members(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists expenses_mess_date_idx on expenses(mess_id, spent_on);

-- What each member was charged for an expense. These rows ARE the cuts.
create table if not exists expense_shares (
  expense_id  int not null references expenses(id) on delete cascade,
  member_id   int not null references members(id),
  amount      int not null,
  meals       int,              -- bazar only: meals this member ate that day
  custom      boolean not null default false,  -- manager typed this amount
  reason      text,             -- manager's reason for a custom amount
  primary key (expense_id, member_id)
);
create index if not exists expense_shares_member_idx on expense_shares(member_id);

create table if not exists meals (
  mess_id     int not null references messes(id) on delete cascade,
  member_id   int not null references members(id),
  meal_date   date not null,
  count       int not null check (count >= 0 and count <= 20),
  updated_by  int references members(id),
  updated_at  timestamptz not null default now(),
  primary key (member_id, meal_date)
);
create index if not exists meals_mess_date_idx on meals(mess_id, meal_date);

create table if not exists deposits (
  id          serial primary key,
  mess_id     int not null references messes(id) on delete cascade,
  member_id   int not null references members(id),
  amount      int not null check (amount <> 0),
  paid_on     date not null,
  method      text not null default 'cash',
  note        text,
  created_by  int references members(id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists deposits_member_idx on deposits(member_id);

create table if not exists notifications (
  id          serial primary key,
  member_id   int not null references members(id) on delete cascade,
  title       text not null,
  body        text not null,
  url         text,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index if not exists notifications_member_idx on notifications(member_id, created_at desc);

create table if not exists push_subscriptions (
  id          serial primary key,
  member_id   int not null references members(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists audit_log (
  id          serial primary key,
  mess_id     int not null references messes(id) on delete cascade,
  actor_id    int references members(id),
  action      text not null,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_mess_idx on audit_log(mess_id, created_at desc);
