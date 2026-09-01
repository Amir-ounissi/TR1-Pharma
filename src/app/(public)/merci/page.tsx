import Link from "next/link";
import { MarketingPageEvent, MarketingTrackedLink } from "@/components/marketing/marketing-events";

export default function ThankYouPage() {
  const bookingUrl = safeBookingUrl(process.env.BOOKING_URL);
  return <main className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center px-5 py-16 text-center"><MarketingPageEvent event="thank_you_view" /><div><p className="font-mono text-xs font-bold uppercase tracking-[.18em] text-[#c9562d]">Demande reçue</p><h1 className="mt-4 text-5xl font-black tracking-[-.06em]">Merci. Nous allons analyser votre organisation.</h1><div className="mx-auto mt-8 grid max-w-xl gap-3 text-left text-[#596574]">{["Votre demande a bien été enregistrée.","L’échange inclura un diagnostic et une démonstration personnalisée.","Un pilote pourra être proposé si TR1 est adapté à votre réseau."].map((text,index)=><p className="rounded-lg border border-[#d8d0c2] bg-[#fffaf0] p-4" key={text}><span className="mr-3 font-mono text-[#c9562d]">0{index+1}</span>{text}</p>)}</div>{bookingUrl ? <MarketingTrackedLink className="mt-8 inline-flex rounded-md bg-[#0f2740] px-5 py-3 font-mono text-xs font-black uppercase text-white" event="booking_click" href={bookingUrl}>Réserver un échange</MarketingTrackedLink> : <p className="mt-8 text-sm text-[#66717d]">L’équipe TR1 vous recontactera directement.</p>}<p className="mt-6"><Link className="text-sm underline" href="/">Retour au site</Link></p></div></main>;
}

function safeBookingUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:") ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
