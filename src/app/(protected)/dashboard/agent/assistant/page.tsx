import { AssistantConsole } from "@/components/agent/assistant-console";
import { requireActiveBrand } from "@/lib/auth";

export default async function AssistantTerrainPage() {
  const { brand, profile } = await requireActiveBrand();
  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <header className="rounded-3xl bg-[#0f2740] px-5 py-6 text-[#fffaf0] sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#7fb8df]">Terrain · {brand.name}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Assistant Terrain</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#d7e2eb]">
          Préparez une interaction ou une tâche, vérifiez le brouillon, puis confirmez explicitement.
        </p>
      </header>
      <AssistantConsole brandName={brand.name} firstName={profile.full_name.split(" ")[0]} />
    </main>
  );
}

