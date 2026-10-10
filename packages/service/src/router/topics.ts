// ---
// relationships:
//   implements: durable-event-delivery
//   references: router-events
// ---
import type { SourceEvent, Subscription } from "./types.ts";

function prefixes(topic: string) {
  const segments = topic.split(".");
  return segments.map((_, i) => segments.slice(0, i + 1).join("."));
}

export function subscriptionIndex() {
  const subscriptions = new Map<string, Subscription>();
  const topics = new Map<string, Set<string>>();
  function remove(actorId: string) {
    for (const topic of subscriptions.get(actorId)?.topics ?? []) {
      const actors = topics.get(topic)!;
      actors.delete(actorId);
      if (actors.size === 0) topics.delete(topic);
    }
    subscriptions.delete(actorId);
  }
  return {
    remove,
    set(actorId: string, subscription: Subscription) {
      remove(actorId);
      subscriptions.set(actorId, {
        topics: [...subscription.topics],
        ...(subscription.events ? { events: [...subscription.events] } : {}),
      });
      for (const topic of subscription.topics) {
        const actors = topics.get(topic) ?? new Set<string>();
        actors.add(actorId);
        topics.set(topic, actors);
      }
    },
    targets(event: SourceEvent) {
      const matched = new Set<string>();
      const groups = new Map<string, string[]>();
      for (const topic of event.topics) {
        const group: string[] = [];
        for (const prefix of prefixes(topic)) {
          for (const actorId of topics.get(prefix) ?? []) {
            const events = subscriptions.get(actorId)!.events;
            if (matched.has(actorId) || (events && !events.includes(event.event.type))) continue;
            matched.add(actorId);
            group.push(actorId);
          }
        }
        if (group.length) groups.set(topic, group);
      }
      return groups;
    },
  };
}
