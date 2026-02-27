import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Scenario } from "@/types";

export default async function Page() {
  const { scenarios } = await getScenarios();

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-8">
      <div className="mx-auto w-full max-w-7xl space-y-12">
        <div className="space-y-4 text-center">
          <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Contexta Voice Agent
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            Experience real-time, context-driven AI voice conversations. Select
            a scenario below to start talking.
          </p>
        </div>

        {scenarios.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center">
            No scenarios found.
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-3">
            {scenarios.map((scenario) => (
              <Link
                key={scenario.id}
                href={`/chat/${scenario.id}`}
                className="group focus-visible:ring-ring block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <Card className="border-border/50 bg-card hover:border-border h-full gap-0 overflow-hidden border p-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
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
    </div>
  );
}

function getGradient(id: string) {
  switch (id) {
    case "calling-agent":
      return "from-blue-500 to-cyan-400";
    case "customer-support":
      return "from-purple-500 to-rose-400";
    case "technical-assistant":
      return "from-emerald-500 to-teal-400";
    default:
      return "from-slate-600 to-slate-400";
  }
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
