import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  ClipboardList,
  PackageCheck,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ImpactRow } from "@/components/missions/mission-impact";
import type { PharmacyCockpit } from "@/lib/pharmacy-cockpit";
import { uiLabel } from "@/lib/ui-copy";

type MissionRow = {
  id: string;
  title: string;
  mission_type: string;
  status: string;
  scheduled_start_at: string | null;
  actual_end_at: string | null;
  completed_at: string | null;
};

type PharmacyCockpitProps = {
  brandPharmacyId: string;
  objective: PharmacyCockpit;
  lastInteractionAt?: string | null;
  lastOrderAt?: string | null;
  validOrderCount?: number | null;
  reorderCount?: number | null;
  averageDaysBetweenOrders?: number | null;
  firstReorderAt?: string | null;
  strategicDistributionRate?: number | null;
  missingProductCount?: number;
  nextActionType?: string | null;
  nextActionAt?: string | null;
  missions: MissionRow[];
  impacts: ImpactRow[];
  canViewFinancials: boolean;
  isOperational: boolean;
};

const missionLabels: Record<string, string> = {
  animation: "Animation",
  training: "Formation",
  merchandising: "Merchandising",
  commercial_visit: "Visite commerciale",
  prospecting_visit: "Visite de prospection",
  relationship_visit: "Visite relationnelle",
  reactivation: "Réactivation",
  pharmacy_audit: "Relevé terrain",
  product_launch: "Mise en avant",
  stock_check: "Relevé stock",
  other: "Autre intervention",
};

const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
        new Date(value),
      )
    : "—";
const money = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

export function PharmacyCockpit(props: PharmacyCockpitProps) {
  const animations = props.missions.filter(
    (mission) => mission.mission_type === "animation",
  );
  const trainings = props.missions.filter(
    (mission) => mission.mission_type === "training",
  );
  const otherMissions = props.missions.filter(
    (mission) => !["animation", "training"].includes(mission.mission_type),
  );
  const animationImpacts = props.impacts.filter(
    (impact) => impact.mission_type === "animation",
  );
  const trainingImpacts = props.impacts.filter(
    (impact) => impact.mission_type === "training",
  );

  return (
    <div className="space-y-6" data-testid="pharmacy-cockpit">
      <section className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <Card
          className="border-[var(--tr1-line-strong)]"
          data-testid="pharmacy-commercial-objective"
        >
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[.14em] text-[var(--tr1-orange)]">
                Objectif commercial actuel
              </p>
              <CardTitle className="mt-1 text-2xl">
                {props.objective.objectiveLabel}
              </CardTitle>
            </div>
            <Badge className="bg-[var(--tr1-navy)] text-white">
              {props.objective.objectiveLabel}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-semibold">
                Pourquoi ce compte nécessite une action
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {props.objective.reasons.map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
              </ul>
            </div>
            <Button asChild>
              <Link href={props.objective.primaryAction.href}>
                {props.objective.primaryAction.label}
                <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card data-testid="pharmacy-next-action">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck2 className="size-4 text-[var(--tr1-orange)]" />
              Prochaine action
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {props.nextActionType
                ? uiLabel(props.nextActionType)
                : "À définir"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {props.nextActionAt
                ? date(props.nextActionAt)
                : "Planifiez l’action qui fera avancer le compte."}
            </p>
          </CardContent>
        </Card>
      </section>

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        data-testid="pharmacy-commercial-situation"
      >
        <Metric
          icon={ClipboardList}
          label="Dernière interaction"
          value={date(props.lastInteractionAt)}
        />
        <Metric
          icon={PackageCheck}
          label="Dernière commande"
          value={date(props.lastOrderAt)}
        />
        <Metric
          icon={TrendingUp}
          label="Commandes / réassorts"
          value={`${props.validOrderCount ?? 0} / ${props.reorderCount ?? 0}`}
        />
        <Metric
          icon={CalendarCheck2}
          label="Fréquence observée"
          value={
            props.averageDaysBetweenOrders
              ? `${props.averageDaysBetweenOrders} jours`
              : "Données insuffisantes"
          }
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Situation commerciale</CardTitle>
            <CardDescription>
              Commandes, réassorts et assortiment du compte.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail
              label="Premier réassort"
              value={date(props.firstReorderAt)}
            />
            <Detail
              label="Références stratégiques"
              value={`${Number(props.strategicDistributionRate ?? 0).toFixed(0)} % détenues`}
            />
            <Detail
              label="Références à travailler"
              value={
                props.missingProductCount
                  ? `${props.missingProductCount} à compléter`
                  : "Aucune identifiée"
              }
            />
            <Detail
              label="Prochaine action"
              value={props.nextActionType || "Aucune"}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mémoire commerciale et terrain</CardTitle>
            <CardDescription>
              Les dernières interventions utiles sur ce compte.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {props.missions.slice(0, 3).map((mission) => (
              <Link
                className="block rounded-md border p-3 transition hover:bg-muted/40"
                href={`/dashboard/missions/${mission.id}`}
                key={mission.id}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong>
                    {missionLabels[mission.mission_type] ??
                      uiLabel(mission.mission_type)}
                  </strong>
                  <Badge variant="outline">{uiLabel(mission.status)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mission.title} ·{" "}
                  {date(
                    mission.actual_end_at ||
                      mission.completed_at ||
                      mission.scheduled_start_at,
                  )}
                </p>
              </Link>
            ))}
            {!props.missions.length ? (
              <p className="text-sm text-muted-foreground">
                Aucune intervention terrain visible.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" data-testid="pharmacy-activations">
        <div>
          <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[.14em] text-[var(--tr1-orange)]">
            Activations terrain
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            Ce qui a été réalisé sur ce compte
          </h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <ActivationCard
            title="Animations"
            missions={animations}
            impacts={animationImpacts}
            primaryMetric="unités vendues"
            metricValue={animationImpacts.reduce(
              (total, impact) => total + Number(impact.sell_out_units ?? 0),
              0,
            )}
            canViewFinancials={props.canViewFinancials}
          />
          <ActivationCard
            title="Formations"
            missions={trainings}
            impacts={trainingImpacts}
            primaryMetric="participants"
            metricValue={trainingImpacts.reduce(
              (total, impact) => total + Number(impact.participants_count ?? 0),
              0,
            )}
            canViewFinancials={false}
          />
          <ActivationCard
            title="Autres missions"
            missions={otherMissions}
            impacts={[]}
            primaryMetric="missions réalisées"
            metricValue={
              otherMissions.filter((mission) => mission.status === "completed")
                .length
            }
            canViewFinancials={false}
          />
        </div>
      </section>

      <section className="space-y-4" data-testid="pharmacy-observed-results">
        <div>
          <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[.14em] text-[var(--tr1-orange)]">
            Résultats observés après les actions terrain
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            Observation, pas causalité
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Les évolutions observées après une intervention ne démontrent pas à
            elles seules un lien de causalité.
          </p>
        </div>
        {props.impacts.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {props.impacts.slice(0, 4).map((impact) => (
              <ObservedResult
                canViewFinancials={props.canViewFinancials}
                impact={impact}
                key={impact.mission_id}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Aucun résultat post-mission suffisamment renseigné n’est
              disponible.
            </CardContent>
          </Card>
        )}
      </section>

      {props.isOperational ? (
        <p className="text-xs text-muted-foreground">
          Cette vue présente uniquement les informations nécessaires à votre
          compte affecté. Les données financières globales de la marque restent
          réservées au pilotage.
        </p>
      ) : null}
    </div>
  );
}

function ActivationCard({
  title,
  missions,
  impacts,
  primaryMetric,
  metricValue,
  canViewFinancials,
}: {
  title: string;
  missions: MissionRow[];
  impacts: ImpactRow[];
  primaryMetric: string;
  metricValue: number;
  canViewFinancials: boolean;
}) {
  const completed = missions.filter(
    (mission) => mission.status === "completed",
  );
  const upcoming = missions.find(
    (mission) =>
      !["completed", "cancelled", "rejected", "no_show"].includes(
        mission.status,
      ),
  );
  const last = completed[0];
  const totalCost = impacts.reduce(
    (total, impact) => total + Number(impact.mission_total_cost ?? 0),
    0,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Detail label="Réalisées" value={`${completed.length}`} />
        <Detail
          label="Dernière"
          value={
            last
              ? date(
                  last.actual_end_at ||
                    last.completed_at ||
                    last.scheduled_start_at,
                )
              : "—"
          }
        />
        <Detail
          label="Prochaine"
          value={
            upcoming ? date(upcoming.scheduled_start_at) : "Aucune planifiée"
          }
        />
        <Detail label={primaryMetric} value={`${metricValue}`} />
        {canViewFinancials && impacts.length ? (
          <Detail label="Coût déclaré" value={money(totalCost)} />
        ) : null}
        {missions[0] ? (
          <Button asChild className="w-full" size="sm" variant="outline">
            <Link href={`/dashboard/missions/${missions[0].id}`}>
              Voir l’historique
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ObservedResult({
  impact,
  canViewFinancials,
}: {
  impact: ImpactRow;
  canViewFinancials: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">
            {missionLabels[String(impact.mission_type)] ?? "Mission terrain"}
          </CardTitle>
          <Badge variant="outline">
            {date(String(impact.mission_date ?? ""))}
          </Badge>
        </div>
        <CardDescription>{String(impact.mission_title ?? "")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        <Detail
          label="Résultat déclaré"
          value={
            impact.sell_out_units != null
              ? `${impact.sell_out_units} unités vendues`
              : impact.participants_count != null
                ? `${impact.participants_count} participants`
                : "Non renseigné"
          }
        />
        <Detail
          label="Commande après mission"
          value={
            impact.first_order_after_at
              ? date(impact.first_order_after_at)
              : "Non observée"
          }
        />
        <Detail
          label="Réassort observé"
          value={
            impact.reorder_observed_60d ? "Oui, sous 60 jours" : "Non observé"
          }
        />
        {canViewFinancials ? (
          <>
            <Detail
              label="CA observé J+30"
              value={money(impact.revenue_30d_after)}
            />
            <Detail
              label="CA observé J+60"
              value={money(impact.revenue_60d_after)}
            />
            <Detail
              label="CA observé J+90"
              value={money(impact.revenue_90d_after)}
            />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <Icon className="size-4 text-[var(--tr1-orange)]" />
        <p className="mt-3 text-lg font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
