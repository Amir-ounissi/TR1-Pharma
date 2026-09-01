import { redirect } from "next/navigation";

export default async function MissionPerformancePage() {
  redirect("/dashboard/network?view=missions");
}
