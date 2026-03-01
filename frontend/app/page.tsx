import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Scenario } from "@/lib/types";
import { getGradient } from "@/lib/utils";

export default async function Page() {
  const { scenarios } = await getScenarios();

  return (
    <main className="flex w-full max-w-7xl flex-1 flex-col items-center py-8">
      <div className="mx-auto w-full">
        {scenarios.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center">
            No scenarios found.
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-8">
            {scenarios.map((scenario) => (
              <Link
                key={scenario.id}
                href={`/chat/${scenario.id}`}
                className="group focus-visible:ring-ring block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <Card className="border-border/50 bg-card hover:border-border h-full min-w-96 gap-0 overflow-hidden border p-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <div
                    className={`h-48 w-full shrink-0 bg-linear-to-br opacity-80 transition-opacity duration-300 group-hover:opacity-100 ${getGradient(scenario.id)}`}
                  />
                  <CardHeader className="py-4">
                    <CardTitle className="text-2xl">{scenario.name}</CardTitle>
                    <CardDescription className="mt-3 text-base leading-relaxed">
                      {scenario.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

async function getScenarios() {
  try {
    const baseUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const res = await fetch(`${baseUrl}/scenarios`, {
      next: { revalidate: 3600 }, // cache for 1 hour
    });
    if (!res.ok) {
      return { scenarios: [] };
    }
    return (await res.json()) as { scenarios: Scenario[] };
  } catch (err) {
    console.error("Error fetching scenarios:", err);
    return { scenarios: [] };
  }
}
