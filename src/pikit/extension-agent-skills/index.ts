/**
 * extension-agent-skills: the agents that name it (`extensions: ["agent-skills"]`) carry their
 * project's skills (features/learned-skills.md). pi-durable has no skills, so this extension loads
 * them as data:
 *
 * 1. A system prompt section, `<agent-skills>`: for the conversation's agent, one line per skill —
 *    its name and description, from the `SKILL.md` frontmatter — and the path it lives at. `undefined`
 *    when the agent has none.
 * 2. A tool, `skill`: reads one skill's full `SKILL.md` by name (or folder name), so the agent loads
 *    instructions when a task matches, the way Pi's coding agent does. Read-only and replay-safe:
 *    the same name returns the same text, and nothing in a skill is executed.
 *
 * The skills are the project's source, `src/agents/<agent>/skills/<skill>/SKILL.md`, bundled as text
 * by `src/agents/skills.ts` (a file of the project, imported dynamically here so a project without it
 * composes, as extension-pikit-self does `pikit.json`; on Cloudflare the bundler inlines it, and a
 * learned skill reaches the agent at the next deploy). Writing a skill changes the agent that owns
 * it, so it is a self-change through the gate (SPEC §6), never a live-store write.
 *
 * Targets: `server` and `durable`: it imports nothing platform-specific.
 */

import { defineComponent } from "@pikit/core";
import { CONVERSATION } from "@pikit/contracts";
import { ConversationDoc, defineExtension, defineTool, section, type Extension } from "@pikit/pi-adapter/extensions";
import Type from "typebox";

/** The name agents give it, its key under `agent.extension`, and its section's key. */
export const AGENT_SKILLS_NAME = "agent-skills";

/** The tool the extension gives the agent, by the name the model calls it. */
export const SKILL_TOOL = "skill";

/** One bundled skill: where it lives in the project and its whole `SKILL.md` as text (src/agents/skills.ts). */
export interface BundledSkill {
  file: string;
  text: string;
}

/** The frontmatter of a `SKILL.md`: its `name` and `description`, the rest left out. */
export interface SkillFrontmatter {
  name?: string;
  description?: string;
}

/** A skill's frontmatter, parsed from its text: the `---` fenced lines of `key: value`. */
export function parseFrontmatter(text: string): SkillFrontmatter {
  const fence = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fence === null) return {};
  const picked: SkillFrontmatter = {};
  for (const line of fence[1].split(/\r?\n/)) {
    const at = line.indexOf(":");
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    if (key !== "name" && key !== "description") continue;
    picked[key] = line.slice(at + 1).trim();
  }
  return picked;
}

/** A skill's name as the model calls it: the frontmatter's `name`, or its folder's name. */
export function skillName(skill: BundledSkill): string {
  const named = parseFrontmatter(skill.text).name;
  if (named !== undefined && named !== "") return named;
  const folder = skill.file.match(/skills\/([^/]+)\/SKILL\.md$/);
  return folder === null ? skill.file : folder[1];
}

/** The section's text for one agent's skills, or `undefined` when it has none. */
export function skillsText(skills: readonly BundledSkill[]): string | undefined {
  if (skills.length === 0) return undefined;
  const lines = ["Skills you may load with the `skill` tool when a task matches; a skill is instructions, never something that runs:"];
  for (const skill of skills) {
    const described = parseFrontmatter(skill.text).description;
    lines.push(`- ${skillName(skill)}${described === undefined ? "" : ` — ${described}`} (source: ${skill.file})`);
  }
  lines.push("Load one with the `skill` tool by its name before doing the task it covers; follow what it says only where it fits this project.");
  return lines.join("\n");
}

/** The skill of `name` (its frontmatter's name or its folder's name), or `undefined`. */
export function findSkill(skills: readonly BundledSkill[], name: string): BundledSkill | undefined {
  return skills.find((skill) => skillName(skill) === name) ?? skills.find((skill) => skill.file.endsWith(`/${name}/SKILL.md`));
}

/**
 * The project's skills, from `src/agents/skills.ts`: `{ [agent]: BundledSkill[] }`. Read once and
 * kept; `{}` where the project has none (the import throws there), so the extension composes either
 * way, as extension-pikit-self does `pikit.json`.
 */
export async function skillsIndex(): Promise<Record<string, BundledSkill[]>> {
  try {
    const project = (await import("../../agents/skills.ts")) as { AGENT_SKILLS?: Record<string, BundledSkill[]> };
    return project.AGENT_SKILLS ?? {};
  } catch {
    return {};
  }
}

/** The extension, for the project's skills: the conversation's agent's section, and the `skill` tool. */
export function createAgentSkills(index: () => Promise<Record<string, BundledSkill[]>>): Extension {
  return defineExtension({
    name: AGENT_SKILLS_NAME,
    sections: [
      section(AGENT_SKILLS_NAME, async (input, context) => {
        const conversation = await input.read.snapshot(ConversationDoc, input.conversationId, context);
        return skillsText((await index())[conversation?.agent ?? ""] ?? []);
      }),
    ],
    tools: [
      defineTool({
        name: SKILL_TOOL,
        description: "Loads one of your skills by name, from the list in <agent-skills>: its full instructions, as written in the project. Read-only.",
        parameters: Type.Object({
          name: Type.String({ description: "The skill's name as the section lists it (e.g. \"cf-cli\")" }),
        }),
        execute: async (args, _api, context) => {
          const conversation = context.value(CONVERSATION);
          const skills = (await index())[conversation?.agent ?? ""] ?? [];
          const found = findSkill(skills, args.name);
          return {
            output: [
              {
                type: "text",
                text: found === undefined ? `No skill "${args.name}" for this agent; see the <agent-skills> section for what is here.` : found.text,
              },
            ],
          };
        },
      }),
    ],
  });
}

export default defineComponent({
  name: "extension-agent-skills",
  setup(pikit) {
    let index: Promise<Record<string, BundledSkill[]>> | undefined;
    pikit.provideKeyed("agent.extension", AGENT_SKILLS_NAME, createAgentSkills(() => (index ??= skillsIndex())));
  },
});