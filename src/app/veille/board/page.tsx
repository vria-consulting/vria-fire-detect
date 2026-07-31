import { redirect } from "next/navigation";
import { hasValidSession } from "@/lib/adminSession";
import { VeilleDashboard } from "@/components/VeilleDashboard";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  if (!(await hasValidSession())) redirect("/veille");
  return <VeilleDashboard />;
}
