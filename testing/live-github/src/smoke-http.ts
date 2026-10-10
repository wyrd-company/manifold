// ---
// relationships:
//   implements: live-github-environment
// ---
export async function hasTaskActor(address: string, issue: string) {
  const response = await fetch(`${address}/api/actors`);
  if (response.status !== 200) throw Error(`Actors API returned ${response.status}`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("actors" in data) || !Array.isArray(data.actors))
    throw Error("Actors API returned invalid shape");
  return data.actors.some(
    (actor) => actor && typeof actor === "object" && actor.actorId === `task:${issue}`,
  );
}
export function deliveryIssue(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || !("projects_v2_item" in payload)) return undefined;
  const item = payload.projects_v2_item;
  return item &&
    typeof item === "object" &&
    "content_node_id" in item &&
    typeof item.content_node_id === "string"
    ? item.content_node_id
    : undefined;
}
