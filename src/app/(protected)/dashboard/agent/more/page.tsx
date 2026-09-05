import Link from "next/link";
import { NavigationIcon } from "@/components/shell/navigation-icons";
import { Card, CardContent } from "@/components/ui/card";
import { getAgentMoreItems } from "@/lib/ux/navigation";

export default function AgentMorePage() {
  return <div className="space-y-5"><header><h1 className="text-2xl font-semibold">Plus</h1><p className="text-muted-foreground">Retrouvez les outils complémentaires à votre activité terrain.</p></header><div className="grid gap-3 sm:grid-cols-2">{getAgentMoreItems().map((item) => <Link href={item.href} key={item.href}><Card className="h-full transition hover:border-[var(--tr1-orange)]"><CardContent className="flex items-center gap-3 p-5"><span className="grid size-10 place-items-center rounded-md bg-muted"><NavigationIcon className="size-5 text-[var(--tr1-navy)]" name={item.icon} /></span><span className="font-semibold">{item.label}</span></CardContent></Card></Link>)}</div></div>;
}
