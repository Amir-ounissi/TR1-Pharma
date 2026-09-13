import Link from "next/link";
import { MarketingPageEvent, MarketingTrackedLink } from "@/components/marketing/marketing-events";

export default function ThankYouPage() {
  const bookingUrl = safeBookingUrl(process.env.BOOKING_URL);

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center px-5 py-16 text-center">
      <MarketingPageEvent event="thank_you_view" />
      <div>
        <p className="font-mono text-xs font-bold uppercase tracking-[.16em] text-[#c9562d]">Demande reçue</p>
        <h1 className="mt-4 text-4xl font-black tracking-[-.035em] sm:text-5xl">Votre demande a bien été envoyée.</h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-[#596574]">Nous vous recontacterons pour convenir d’un créneau de démonstration.</p>
        {bookingUrl ? (
          <MarketingTrackedLink className="mt-8 inline-flex rounded-md bg-[#0f2740] px-5 py-3 font-mono text-xs font-black uppercase text-white" event="booking_click" href={bookingUrl}>Choisir un créneau</MarketingTrackedLink>
        ) : null}
        <p className="mt-6"><Link className="text-sm underline" href="/">Retour au site</Link></p>
      </div>
    </main>
  );
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
