create table if not exists chat_message_traces (
  message_id text primary key not null references chat_messages(id) on delete cascade,
  stream_json text not null,
  created_at text not null,
  updated_at text not null
);
