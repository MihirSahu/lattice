-- Keep historical answers intact while routing future turns through OpenCode.
update chat_threads
set engine = 'opencode',
    model = 'openai/gpt-5.5',
    openai_route = 'openrouter'
where engine = 'qmd';
