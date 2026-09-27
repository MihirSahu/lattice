-- Normalize future requests without modifying historical messages, traces, or timestamps.
update chat_threads
set engine = 'opencode', model = 'openai/gpt-6-luna', openai_route = 'openrouter';
