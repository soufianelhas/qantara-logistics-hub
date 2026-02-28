import { AppLayout } from "@/components/AppLayout";
import { CompassContent } from "@/components/CompassContent";

export default function MarketIntelligence() {
    return (
        <AppLayout title="The Compass" subtitle="Strategic Market Identification & Benchmarking">
            <div className="max-w-5xl mx-auto space-y-6">
                <CompassContent isOverlay={false} />
            </div>
        </AppLayout>
    );
}
