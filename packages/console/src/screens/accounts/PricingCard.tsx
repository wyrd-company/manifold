// ---
// relationships:
//   implements: operator-console
// ---
import type { PortfolioPricing } from "@wyrd-company/manifold-shared/portfolio-api";
export function PricingCard({ pricing }: { pricing: PortfolioPricing }) {
  return (
    <section className="accounts-pricing">
      <h3>Pricing</h3>
      <p>Each call is priced at its model's API price, for subscriptions too.</p>
      <p className="muted">
        Price table: LiteLLM at {pricing.bundledCommit.slice(0, 7)}, {pricing.bundledModels} models
      </p>
      <p className="muted">
        {pricing.overrides
          ? `${pricing.overrides} models priced in prices.yml`
          : "No models priced in prices.yml"}
      </p>
      {pricing.unpriced.length ? (
        <>
          <p className="warning-text">{pricing.unpriced.length} models in use have no price</p>
          <ul>
            {pricing.unpriced.map((entry) => (
              <li key={JSON.stringify([entry.provider, entry.model])}>
                <span className="mono">
                  {entry.provider} · {entry.model ?? "no model name"}
                </span>{" "}
                · {entry.postings} calls waiting
              </li>
            ))}
          </ul>
          <p className="muted">
            Price them in prices.yml. Their calls are charged when the price is in force.
          </p>
        </>
      ) : null}
    </section>
  );
}
