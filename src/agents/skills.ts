/**
 * The project's agent skills, bundled as text: one folder with a `SKILL.md` per skill, under the
 * agent that owns it (`src/agents/<agent>/skills/<skill>/SKILL.md`, features/learned-skills.md).
 *
 * This file is the bridge pi-durable needs: it has no skills, so `extension-agent-skills` loads them
 * as data — a system prompt section lists each skill's name and description, and the agent reads the
 * one it needs with its `skill` tool. Bundled here as text (the agentskills format, Pi's own
 * coding-agent format), the text reaches the agent at the next deploy; nothing runs at load time and
 * nothing in a skill is executed.
 *
 * A skill changes the agent that owns it, so writing one is a self-change (SPEC §6): a branch,
 * tests, the operator's approval, a deploy.
 */

import CF_CLI from "./assistant/skills/cf-cli/SKILL.md" with { type: "text" };
import FIND_BUGS from "./assistant/skills/find-bugs/SKILL.md" with { type: "text" };

/** One skill's source: where it lives in the project, and its `SKILL.md` as text. */
export interface AgentSkillSource {
  /** The project path of its `SKILL.md`, for the section to cite and provenance to be checkable. */
  file: string;
  /** The whole `SKILL.md` (frontmatter included), bundled at build time. */
  text: string;
}

/** The skills of each agent, keyed by the agent's name. An agent with none may be left out. */
export const AGENT_SKILLS: Record<string, AgentSkillSource[]> = {
  assistant: [
    {
      file: "src/agents/assistant/skills/cf-cli/SKILL.md",
      text: CF_CLI,
    },
    {
      file: "src/agents/assistant/skills/find-bugs/SKILL.md",
      text: FIND_BUGS,
    },
  ],
};