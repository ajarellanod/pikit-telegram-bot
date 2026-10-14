/**
 * The project's agents, provided to the runtime under `agent.definition`. A project
 * component: it lives here, not in `src/pikit/`, because the agents are yours.
 */

import { defineComponent } from "@pikit/core";
import admaki from "../agents/admaki/agent.ts";

export default defineComponent({
  name: "agents",
  setup(pikit) {
    pikit.provideKeyed("agent.definition", admaki.name, admaki);
  },
});
