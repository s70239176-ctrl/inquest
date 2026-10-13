import { useBountyFeed } from "../hooks.ts";
import { protocolStats } from "../lib/view.ts";
import { HeroSection } from "../components/home/HeroSection.tsx";
import { StatsStrip } from "../components/home/StatsStrip.tsx";
import { HowItWorks } from "../components/home/HowItWorks.tsx";
import { LatestBounties } from "../components/home/LatestBounties.tsx";
import { ClosingCta } from "../components/home/ClosingCta.tsx";

/** The editorial homepage: ivory publication on top, the dark protocol surface below. */
export function Home() {
  const { data, error, loading, reload, now } = useBountyFeed(20);
  const stats = data ? protocolStats(data.items, data.total, now) : null;

  return (
    <>
      <HeroSection />
      <StatsStrip stats={stats} />
      <HowItWorks />
      <LatestBounties bounties={data?.items ?? null} total={data?.total ?? 0} now={now} loading={loading} error={error} onRetry={reload} />
      <ClosingCta />
    </>
  );
}
