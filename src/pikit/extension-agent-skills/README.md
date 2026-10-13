# extension-agent-skills

The agents that name it (`extensions: ["agent-skills"]`) carry their project's skills:
instructions in `src/agents/<agent>/skills/<skill>/SKILL.md` (the agentskills format, Pi's own
coding-agent format) that the agent loads when a task matches their description.

pi-durable has no skills, so this extension loads them as data (features/learned-skills.md):

- A system prompt section, `<agent-skills>`: for the conversation's agent, one line per skill — its
  name and description, from the `SKILL.md` frontmatter — and the project path it lives at. Left out
  when the agent has none.
- A tool, `skill`: returns one skill's full `SKILL.md` by name (the frontmatter's `name`, or its
  folder's), so the agent loads the instructions when it needs them. Read-only and replay-safe: the
  same name returns the same text, and nothing in a skill is executed.

## Where the skills are

`src/agents/skills.ts`, a file of the project, bundles each `SKILL.md` as text and keys them by the
agent that owns them (`AGENT_SKILLS`). The component imports it dynamically and composes with `{}`
where a project has none, as extension-pikit-self does `pikit.json`. Bundled as text, a skill
reaches the agent at the next deploy: on Cloudflare nothing is read at run time.

## Writing a skill

A skill changes the agent that owns it, so it is a self-change (SPEC §6): a branch
(`pikit/self/<topic>`), tests, the operator's approval in the dashboard, a deploy. There is no second
path: nothing writes skills into a live store the running agent loads.

A skill's `SKILL.md` starts with fenced frontmatter — `name` (how the model asks for it) and
`description` (when to load it, in one line) — and the instructions below. Keep one skill per folder;
say only what fits the project; never steps that touch secrets, the deployment, or the approval path.

## Provides

- `agent.extension` under `agent-skills`: the section and the `skill` tool.

## Config

None: the skills are the project's source, not values.

## Targets

`server` and `durable`; it imports nothing platform-specific.

## Tests

`extension-agent-skills.test.ts`: frontmatter parsing, section text, lookup, the project's index, and
the extension's shape through a real App (`bun test`). A full run in an App served by runtime-pi is
the registry's suite beside the reference's files.