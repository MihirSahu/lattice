create table if not exists chat_threads (
  id text primary key not null,
  user_email text not null,
  title text not null,
  engine text not null,
  folder text not null default '',
  model text,
  created_at text not null,
  updated_at text not null
);

create table if not exists chat_messages (
  id text primary key not null,
  thread_id text not null references chat_threads(id) on delete cascade,
  role text not null,
  status text not null,
  created_at text not null,
  question text,
  response_json text,
  error_text text,
  error_details_json text,
  error_code text
);

create index if not exists chat_threads_user_email_updated_at_idx
  on chat_threads (user_email, updated_at desc);

create index if not exists chat_messages_thread_id_created_at_idx
  on chat_messages (thread_id, created_at asc);
