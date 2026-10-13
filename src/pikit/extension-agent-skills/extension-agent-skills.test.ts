/**
 * extension-agent-skills's tests. They are copied with the component and keep running in your project.
 *
 * Pure parts offline (frontmatter, section text, lookup, the project's own index), and the extension's
 * shape through a real App: nothing here reaches the network or runs a skill. A full run in an App
 * served by runtime-pi lives in the registry beside the component's files (a component never imports
 * another's files, SPEC P4).
 */

import { expect, test } from "bun:test";
import { defineApp, defineComponent, silentLogger } from "@pikit/core";
import { defineAgent } from "@pikit/contracts";
import type { Extension } from "@pikit/pi-adapter/extensions";
import {
  AGENT_SKILLS_NAME,
  findSkill,
  parseFrontmatter,
  SKILL_TOOL,
  skillName,
  skillsIndex,
  skillsText,
} from "./index.ts";

const WITH_FRONTMATTER = [
  "---",
  "name: cf-cli",
  "description: Cloudflare's official cf CLI (beta). Use it to inspect and diagnose only.",
  "source: somewhere",
  "---",
  "",
  "# Cloudflare CLI (`cf`)",
  "",
  "Body text.",
].join("\n");

const NO_FRONTMATTER = "# Just a title\n\nBody.";

test("parseFrontmatter: name and description from the fenced lines, the rest left out", () => {
  expect(parseFrontmatter(WITH_FRONTMATTER)).toEqual({
    name: "cf-cli",
    description: "Cloudflare's official cf CLI (beta). Use it to inspect and diagnose only.",
  });
});

test("parseFrontmatter: no fence, no keys", () => {
  expect(parseFrontmatter(NO_FRONTMATTER)).toEqual({});
});

test("skillName: the frontmatter's name wins; without one, the folder's", () => {
  expect(skillName({ file: "src/agents/assistant/skills/cf-cli/SKILL.md", text: WITH_FRONTMATTER })).toBe("cf-cli");
  expect(skillName({ file: "src/agents/assistant/skills/tail-logs/SKILL.md", text: NO_FRONTMATTER })).toBe("tail-logs");
});

test("skillsText: one line per skill with its description and path; none, no section", () => {
  const text = skillsText([{ file: "src/agents/assistant/skills/cf-cli/SKILL.md", text: WITH_FRONTMATTER }]);
  expect(text).toContain("- cf-cli — Cloudflare's official cf CLI (beta). Use it to inspect and diagnose only. (source: src/agents/assistant/skills/cf-cli/SKILL.md)");
  expect(text).toContain("`skill` tool");
  expect(skillsText([])).toBeUndefined();
});

test("findSkill: by the frontmatter's name, by the folder's name, and a miss", () => {
  const skills = [{ file: "src/agents/assistant/skills/cf-cli/SKILL.md", text: WITH_FRONTMATTER }];
  expect(findSkill(skills, "cf-cli")?.file).toBe("src/agents/assistant/skills/cf-cli/SKILL.md");
  expect(findSkill(skills, "tail-logs")).toBeUndefined();
});

test("skillsIndex: this project's skills, bundled as text (the section and tool read this)", async () => {
  const index = await skillsIndex();
  const assistant = index["assistant"] ?? [];
  expect(assistant.length).toBeGreaterThan(0);
  expect(findSkill(assistant, "cf-cli")?.text).toContain("# Cloudflare CLI (`cf`)");
  expect(findSkill(assistant, "find-bugs")?.text).toContain("# Find Bugs");
});

test("the extension: its name, its section, and its `skill` tool, provided in an App", async () => {
  let extension: Extension | undefined;
  const reader = defineComponent({
    name: "reader",
    setup: (pikit) => {
      const extensions = pikit.useKeyed("agent.extension");
      return { start: () => void (extension = extensions.get(AGENT_SKILLS_NAME) as Extension | undefined) };
    },
  });
  const agents = defineComponent({
    name: "agents",
    setup: (pikit) =>
      pikit.provideKeyed("agent.definition", "assistant", defineAgent({ name: "assistant", model: "faux/scripted", steward: true, extensions: [AGENT_SKILLS_NAME] })),
  });
  const app = await defineApp({ components: [agents, (await import("./index.ts")).default, reader], config: {}, target: "server", logger: silentLogger }).create();
  await app.start();
  expect(extension?.name).toBe(AGENT_SKILLS_NAME);
  expect(extension?.sections?.length).toBe(1);
  expect(extension?.tools?.map((tool) => tool.name)).toEqual([SKILL_TOOL]);
  await app.stop();
});