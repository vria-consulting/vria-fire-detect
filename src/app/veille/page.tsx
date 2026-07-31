import { redirect } from "next/navigation";
import { hasValidSession } from "@/lib/adminSession";
import { VeilleLogin } from "@/components/VeilleLogin";

export const dynamic = "force-dynamic";

export default async function VeillePage() {
  if (await hasValidSession()) redirect("/veille/board");
  return <VeilleLogin />;
}
