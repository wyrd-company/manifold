// ---
// relationships:
//   implements: agent-threads
// ---
import nunjucks from "nunjucks";
import type { ProcessRepositoryRevision } from "@wyrd-company/manifold-shared";
import { failure } from "./types.ts";
class RevisionLoader extends nunjucks.Loader {
  async = true as const;
  private readonly revision: ProcessRepositoryRevision;
  constructor(revision: ProcessRepositoryRevision) {
    super();
    this.revision = revision;
  }
  getSource(
    path: string,
    callback: (error: Error | null, source: nunjucks.LoaderSource | null) => void,
  ): void {
    void this.revision.read(path).then(
      (text) => {
        if (text === undefined) callback(new Error(`Missing template: ${path}`), null);
        else callback(null, { src: text, path, noCache: true });
      },
      (error) => callback(error instanceof Error ? error : new Error(String(error)), null),
    );
  }
}
export async function render(
  revision: Promise<ProcessRepositoryRevision | undefined>,
  source: string,
  values: Record<string, unknown>,
  inline: boolean,
) {
  try {
    const resolved = await revision;
    if (!resolved) throw new Error("Missing process repository revision");
    const environment = new nunjucks.Environment(new RevisionLoader(resolved), {
      autoescape: false,
      throwOnUndefined: true,
    });
    const text = await new Promise<string>((resolve, reject) => {
      const done = (error: Error | null, value: string | null) => {
        if (error) reject(error);
        else resolve(value ?? "");
      };
      if (inline) environment.renderString(source, values, done);
      else environment.render(source, values, done);
    });
    if (!text.trim()) throw new Error("Template rendered empty text");
    return text.trim();
  } catch (error) {
    throw failure("template", error instanceof Error ? error.message : String(error));
  }
}
