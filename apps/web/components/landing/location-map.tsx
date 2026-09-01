import { MapPin, Navigation } from "lucide-react";
import { siteConfig } from "@/lib/site-config";

type LocationMapProps = {
  className?: string;
};

export function LocationMap({ className = "" }: LocationMapProps) {
  const { lat, lng, mapsUrl, address, landmark } = siteConfig.location;
  const delta = 0.012;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;

  return (
    <div className={`landing-map relative overflow-hidden rounded-3xl ${className}`}>
      <div className="absolute inset-0 z-[2] pointer-events-none bg-gradient-to-t from-[#0a0a0a] via-transparent to-[#0a0a0a]/30" />
      <div className="absolute inset-0 z-[2] pointer-events-none bg-gradient-to-r from-[#0a0a0a]/40 via-transparent to-[#0a0a0a]/40" />

      {/* Animated pin overlay */}
      <div className="absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-full pointer-events-none">
        <div className="landing-map-pulse absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-orange/30" />
        <div className="landing-map-pulse landing-map-pulse-delay absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-yellow/15" />
        <div className="relative flex flex-col items-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-yellow via-brand-amber to-brand-orange shadow-lg shadow-orange-500/50">
            <MapPin size={20} className="text-[#0a0a0a]" fill="currentColor" />
          </div>
          <div className="mt-1 size-0 border-x-8 border-t-[10px] border-x-transparent border-t-brand-orange" />
        </div>
      </div>

      <iframe
        title={`Карта — ${siteConfig.name}`}
        src={embedUrl}
        className="landing-map-frame h-full min-h-[320px] w-full border-0 md:min-h-[420px]"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />

      {/* Bottom info strip */}
      <div className="absolute bottom-0 left-0 right-0 z-[4] flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#0a0a0a]/85 px-5 py-4 backdrop-blur-md">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{address}</p>
          <p className="truncate text-xs text-white/45">{landmark}</p>
        </div>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="landing-btn landing-btn-primary landing-btn-sm"
        >
          <Navigation size={14} />
          Маршрут
        </a>
      </div>
    </div>
  );
}
