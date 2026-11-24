import { requireOwner } from "@/lib/auth";
import { notFound } from "next/navigation";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c as "&"|"<"|">"|'"'|"'"] ?? c));
const money = (value: unknown) => Number(value).toLocaleString("fr-FR",{style:"currency",currency:"EUR"});

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const {db}=await requireOwner();
  const {id}=await params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const {data:order,error}=await db.from("order_requests")
    .select("id,pharmacy_id,brand_id,status,total_ht,created_at").eq("id",id).maybeSingle();
  if(error) throw new Error("Impossible de charger la demande.");
  if(!order) notFound();
  const [pharmacy,brand,lines]=await Promise.all([
    db.from("pharmacies").select("name,city,siret").eq("id",order.pharmacy_id).single(),
    db.from("brands").select("name").eq("id",order.brand_id).single(),
    db.from("order_items").select("id,product_name,sku,quantity,unit_price_ht,line_total_ht")
      .eq("request_id",id).order("id"),
  ]);
  if(pharmacy.error||brand.error||lines.error) throw new Error("Document incomplet : chargement impossible.");
  const items=lines.data??[];
  const total=items.reduce((sum,x)=>sum+Math.round(Number(x.line_total_ht)*100),0);
  const mismatch=total!==Math.round(Number(order.total_ht)*100);
  const labels:Record<string,string>={received:"Reçue",verifying:"À vérifier",forwarded:"Transmise",confirmed:"Confirmée",closed:"Clôturée",declined:"Refusée"};
  const rows=items.map(x=>"<tr><td>"+escape(x.product_name)+"</td><td>"+escape(x.sku||"—")+"</td><td class='num'>"+escape(x.quantity)+"</td><td class='num'>"+escape(money(x.unit_price_ht))+"</td><td class='num'>"+escape(money(x.line_total_ht))+"</td></tr>").join("");
  const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Demande TR1 ${escape(id.slice(0,8))}</title><style>
  *{box-sizing:border-box}body{font:14px/1.5 system-ui,sans-serif;color:#142941;margin:32px auto;padding:0 24px;max-width:850px}h1{font-size:26px;margin:0}h2{font-size:16px}p{margin:8px 0}.top{border-bottom:2px solid #142941;padding:16px 0}.meta{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:16px 0}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:10px 6px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}.num{text-align:right;white-space:nowrap}th{font-size:12px}.total{text-align:right;font-size:19px;font-weight:700}.note{background:#f2f4f6;padding:14px;margin-top:20px}.warning{color:#9b3b12;font-weight:bold}.nav{margin-bottom:16px}@media print{body{margin:0;max-width:none;padding:0}.nav{display:none}thead{display:table-header-group}tr{break-inside:avoid}@page{margin:15mm}}
  </style></head><body><div class="nav"><a href="/app/commandes">Retour aux demandes</a> · Pour un PDF : Imprimer → Enregistrer au format PDF.</div>
  <header class="top"><p>TR1 PHARMA · Intermédiaire commercial</p><h1>Demande de commande — récapitulatif HT</h1><p>Référence : ${escape(order.id)} · ${escape(new Date(order.created_at).toLocaleDateString("fr-FR"))}</p><p>Statut : ${escape(labels[order.status]||order.status)}</p></header>
  <div class="meta"><section><h2>Pharmacie</h2><p>${escape(pharmacy.data?.name)}</p><p>${escape(pharmacy.data?.city)}</p><p>SIRET : ${escape(pharmacy.data?.siret||"non renseigné")}</p></section><section><h2>Marque destinataire</h2><p>${escape(brand.data?.name)}</p></section></div>
  <table><thead><tr><th>Produit</th><th>SKU</th><th class="num">Qté</th><th class="num">PU HT</th><th class="num">Total HT</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="total">Total enregistré : ${escape(money(order.total_ht))}</p>
  ${mismatch||items.length===0?'<p class="warning">Contrôle requis : lignes absentes ou total incohérent. Ne pas transmettre en l’état.</p>':""}
  <p class="note">Récapitulatif interne de la demande, non constitutif d'une facture ni d'une confirmation fournisseur. Les prix sont ceux enregistrés lors de la demande. TVA, UG, franco, adresse complète et conditions finales doivent être contrôlés avant transmission ADV. Aucun envoi automatique.</p></body></html>`;
  return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
}
