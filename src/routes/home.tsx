import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAppSettings, waLink } from "@/lib/settings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRight,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
  Compass,
  Bookmark,
  ShieldCheck,
  Building2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  Tv,
  Film
} from "lucide-react";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Apex Security Ltd — CCTV Cameras, Smart Locks & Security Doors" },
      {
        name: "description",
        content:
          "Secure your space with modern technology and dependable door solutions. Apex Security Ltd brings CCTV cameras, solar security cameras, smart locks and quality security doors together for homes, businesses and building projects across Abuja and Nigeria.",
      },
      { property: "og:title", content: "Apex Security Ltd — Security Electronics & Modern Doors" },
      {
        property: "og:description",
        content: "Apex Security Ltd provides CCTV systems, smart locks, security doors and modern door solutions for homes, businesses and building projects across Abuja and Nigeria.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: s } = useAppSettings();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const companyName = (s as any)?.company_name || "Apex Security Ltd";
  const homepageDesc = (s as any)?.homepage_description || "Secure your space with modern technology and dependable door solutions. Apex Security Ltd brings CCTV cameras, solar security cameras, smart locks and quality security doors together for homes, businesses and building projects across Abuja and Nigeria.";

  // Hero Videos State
  const [heroVideos, setHeroVideos] = useState<any[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  // Showcase Video Slider State (Between Instant WA Quotes and Get in Touch)
  const [showcaseVideos, setShowcaseVideos] = useState<any[]>([]);
  const [currentShowcaseIndex, setCurrentShowcaseIndex] = useState(0);
  const [showcaseMuted, setShowcaseMuted] = useState(true);
  const [showcasePlaying, setShowcasePlaying] = useState(true);

  // Touch gesture state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    const fetchVideos = async () => {
      const { data } = await supabase
        .from("hero_videos")
        .select("*")
        .eq("is_active", true)
        .order("order_index", { ascending: true });
      if (data && data.length > 0) {
        setHeroVideos(data);
      } else {
        setHeroVideos([
          { id: "1", url: "https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-interior-design-39908-large.mp4" },
          { id: "2", url: "https://assets.mixkit.co/videos/preview/mixkit-architectural-model-design-details-39909-large.mp4" },
          { id: "3", url: "https://assets.mixkit.co/videos/preview/mixkit-spinning-architectural-plans-39910-large.mp4" }
        ]);
      }
    };
    void fetchVideos();
  }, []);

  useEffect(() => {
    const fetchShowcase = async () => {
      try {
        const { data } = await supabase
          .from("showcase_videos" as any)
          .select("*")
          .eq("is_active", true)
          .order("order_index", { ascending: true });

        if (data && data.length > 0) {
          setShowcaseVideos(data);
        } else {
          setShowcaseVideos([
            {
              id: "sc-1",
              url: "https://assets.mixkit.co/videos/preview/mixkit-interior-of-a-modern-apartment-39907-large.mp4",
              title: "CCTV Surveillance & Solar Camera Systems"
            },
            {
              id: "sc-2",
              url: "https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-interior-design-39908-large.mp4",
              title: "Smart Locks & Digital Access Solutions"
            },
            {
              id: "sc-3",
              url: "https://assets.mixkit.co/videos/preview/mixkit-architectural-model-design-details-39909-large.mp4",
              title: "Armored Security & Contemporary Doors"
            }
          ]);
        }
      } catch (err) {
        console.warn("Notice loading showcase videos:", err);
      }
    };
    void fetchShowcase();
  }, []);

  const handleShowcaseVideoEnded = () => {
    setCurrentShowcaseIndex((prev) => (prev + 1) % Math.max(1, showcaseVideos.length));
  };

  const handleVideoEnded = () => {
    setCurrentVideoIndex((prev) => (prev + 1) % heroVideos.length);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      setCurrentVideoIndex((prev) => (prev + 1) % heroVideos.length);
    } else if (isRightSwipe) {
      setCurrentVideoIndex((prev) => (prev - 1 + heroVideos.length) % heroVideos.length);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetWa = s?.sales_whatsapp || s?.support_whatsapp || "07063492581";
    setBusy(true);
    try {
      const msg = `Hello ${companyName}! My name is ${name}. Please contact me regarding CCTV cameras, smart locks, and security doors at ${phone}.`;
      window.open(waLink(targetWa, msg), "_blank", "noopener,noreferrer");
      toast.success("Opening WhatsApp Sales Inquiry…");
      setName("");
      setPhone("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      {/* Hero Architectural Banner */}
      <section
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative w-full h-[70vh] min-h-[500px] overflow-hidden bg-canvas"
      >
        {heroVideos.length > 0 && (
          <div className="absolute inset-0 w-full h-full">
            <video
              key={heroVideos[currentVideoIndex]?.id || currentVideoIndex}
              autoPlay
              muted
              playsInline
              onEnded={handleVideoEnded}
              className="w-full h-full object-cover transition-all duration-700 opacity-75"
              src={heroVideos[currentVideoIndex]?.url}
              preload="auto"
            />
            {/* Dark Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/60 to-canvas/20" />
          </div>
        )}

        {/* Content Overlays */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-14 text-foreground">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated/80 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] backdrop-blur text-brand-blue">
              <Sparkles className="h-3.5 w-3.5 text-brand-orange" /> Security & Door Solutions Showroom
            </span>

            <h1 className="font-display text-4xl sm:text-6xl font-extrabold leading-none tracking-tight text-foreground uppercase">
              {companyName}
            </h1>
            <p className="font-display text-sm sm:text-base text-text-secondary max-w-xl leading-relaxed">
              {homepageDesc}
            </p>

            <div className="flex flex-wrap gap-3 pt-3">
              <Link
                to="/search"
                search={{ q: "" }}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-canvas hover:bg-brand-orange-hover transition shadow-lg"
              >
                <Compass className="h-4 w-4" /> Explore Digital Showroom <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/collection"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-elevated/80 backdrop-blur px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-surface transition"
              >
                <Bookmark className="h-4 w-4 text-brand-orange" /> Project Collections
              </Link>
            </div>
          </div>

          {/* Carousel Navigation Indicators */}
          {heroVideos.length > 1 && (
            <div className="absolute bottom-6 right-6 sm:right-14 flex gap-2 z-10">
              {heroVideos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentVideoIndex(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    currentVideoIndex === i ? "w-8 bg-brand-orange" : "w-2 bg-white/40"
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Trust & Company Highlights */}
      <section className="bg-surface border-b border-border py-8">
        <div className="container-app grid gap-6 sm:grid-cols-3">
          <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-surface-elevated">
            <Building2 className="h-8 w-8 text-brand-blue shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-foreground">Security Electronics & CCTV</h4>
              <p className="text-xs text-muted-foreground mt-1">Solar & wired CCTV cameras, high-definition surveillance, and intelligent property monitoring.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-surface-elevated">
            <ShieldCheck className="h-8 w-8 text-brand-orange shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-foreground">Smart Locks & Security Doors</h4>
              <p className="text-xs text-muted-foreground mt-1">Biometric digital door locks, armored security doors, flush doors, pivot doors & toilet doors.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-surface-elevated">
            <MessageCircle className="h-8 w-8 text-brand-blue shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-foreground">Nationwide Service & Quotes</h4>
              <p className="text-xs text-muted-foreground mt-1">Dei-Dei Abuja showroom presence serving residential, commercial & building projects nationwide.</p>
            </div>
          </div>
        </div>
      </section>

      {/* APEX SECURITY Showcase Video Slider (Continuous Showcase) */}
      {showcaseVideos.length > 0 && (
        <section className="bg-canvas text-foreground py-12 border-y border-border shadow-2xl relative overflow-hidden">
          {/* Ambient Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-brand-blue-soft rounded-full blur-3xl pointer-events-none" />

          <div className="container-app space-y-6 relative z-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.25em] text-brand-orange">
                  <Film className="h-3.5 w-3.5 text-brand-orange" /> Security & Door Solutions Showcase
                </div>
                <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground uppercase tracking-tight mt-1">
                  APEX SECURITY Video Showcase
                </h3>
              </div>
              <p className="text-xs text-muted-foreground max-w-md">
                Watch our latest product videos, showroom installations, imported security doors, and premium craftsmanship.
              </p>
            </div>

            {/* Video Player Box */}
            <div className="relative w-full aspect-video max-h-[550px] rounded-2xl overflow-hidden bg-surface border border-border shadow-2xl group">
              <video
                key={showcaseVideos[currentShowcaseIndex]?.id || currentShowcaseIndex}
                autoPlay={showcasePlaying}
                muted={showcaseMuted}
                playsInline
                onEnded={handleShowcaseVideoEnded}
                className="w-full h-full object-cover transition-all duration-700"
                src={showcaseVideos[currentShowcaseIndex]?.url}
                preload="auto"
              />

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-canvas/90 via-transparent to-canvas/30 pointer-events-none" />

              {/* Top Title Overlay Badge */}
              <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2.5 z-10">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-canvas shadow-md">
                  <Tv className="h-3 w-3" /> Video #{currentShowcaseIndex + 1} of {showcaseVideos.length}
                </span>
                {showcaseVideos[currentShowcaseIndex]?.title && (
                  <span className="hidden sm:inline-block rounded-full bg-surface-elevated/80 border border-border px-3.5 py-1 text-xs font-bold text-foreground backdrop-blur">
                    {showcaseVideos[currentShowcaseIndex].title}
                  </span>
                )}
              </div>

              {/* Center Play/Pause Button */}
              <button
                onClick={() => setShowcasePlaying((p) => !p)}
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 backdrop-blur-2xs"
                aria-label={showcasePlaying ? "Pause Video" : "Play Video"}
              >
                <div className="rounded-full bg-surface-elevated/90 border border-border p-4 text-foreground shadow-xl hover:scale-110 transition-transform">
                  {showcasePlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 text-brand-orange fill-brand-orange ml-0.5" />}
                </div>
              </button>

              {/* Bottom Control Strip */}
              <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowcaseMuted((m) => !m)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated/80 border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface transition backdrop-blur"
                  >
                    {showcaseMuted ? <VolumeX className="h-4 w-4 text-brand-orange" /> : <Volume2 className="h-4 w-4 text-brand-blue" />}
                    <span className="hidden sm:inline text-[10px]">{showcaseMuted ? "Unmute" : "Mute"}</span>
                  </button>
                </div>

                {/* Slider Dot Indicators */}
                <div className="flex items-center gap-1.5">
                  {showcaseVideos.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentShowcaseIndex(idx)}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        currentShowcaseIndex === idx ? "w-6 bg-brand-orange" : "w-2 bg-white/40 hover:bg-white/70"
                      }`}
                      aria-label={`Go to video ${idx + 1}`}
                    />
                  ))}
                </div>

                {/* Arrow Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      setCurrentShowcaseIndex(
                        (prev) => (prev - 1 + showcaseVideos.length) % showcaseVideos.length
                      )
                    }
                    className="p-2 rounded-full bg-surface-elevated/80 border border-border text-foreground hover:bg-surface transition backdrop-blur"
                    aria-label="Previous Video"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentShowcaseIndex((prev) => (prev + 1) % showcaseVideos.length)
                    }
                    className="p-2 rounded-full bg-surface-elevated/80 border border-border text-foreground hover:bg-surface transition backdrop-blur"
                    aria-label="Next Video"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Company / Contact Section */}
      <section className="container-app mt-12">
        <div className="text-center max-w-xl mx-auto mb-8 space-y-2">
          <h2 className="font-display text-xs uppercase tracking-[0.2em] font-bold text-brand-orange">
            Get In Touch With {companyName}
          </h2>
          <h3 className="font-display text-3xl font-extrabold text-foreground">Visit Our Showroom & Offices</h3>
          <p className="text-xs text-muted-foreground">
            Contact our security and door specialists for systems consultation, product specs, or nationwide site delivery.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 pb-4">
          <div className="space-y-4">
            <a
              href={s?.map_url || "https://maps.google.com/?q=Opposite+Timber+Shed+Dei-Dei+Abuja+Nigeria"}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-border bg-surface p-5 shadow-xs space-y-3 hover:border-brand-orange transition group"
            >
              <div className="flex items-center gap-3">
                <MapPin className="h-6 w-6 text-brand-orange shrink-0 group-hover:scale-110 transition-transform" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-orange">Business Address (Click for Map)</span>
                  <div className="font-bold text-sm text-foreground group-hover:text-brand-orange transition">
                    {s?.company_address || "Opposite Timber Shed, Dei-Dei, Abuja, Nigeria"}
                  </div>
                  <p className="text-xs text-muted-foreground">Dei-Dei Building Materials Market area · Serving Abuja & Nationwide</p>
                </div>
              </div>
            </a>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="h-6 w-6 text-brand-blue shrink-0" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-blue">Customer Service Line</span>
                  <div className="font-bold text-sm text-foreground">
                    <a href={`tel:${(s as any)?.company_phone || "07063492581"}`} className="hover:text-brand-orange transition">
                      {(s as any)?.company_phone || "07063492581"}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="h-6 w-6 text-[#25D366] shrink-0" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#25D366]">WhatsApp Consultation</span>
                  <div className="font-bold text-sm text-foreground">
                    <a
                      href={`https://wa.me/${(s?.sales_whatsapp || s?.support_whatsapp || "07063492581").replace(/[^\d]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#25D366] transition"
                    >
                      {s?.sales_whatsapp || s?.support_whatsapp || "07063492581"} (Click to Chat)
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {s?.company_email && (
              <a
                href={`mailto:${s.company_email}`}
                className="block rounded-xl border border-border bg-surface p-5 shadow-xs space-y-3 hover:border-brand-blue transition group"
              >
                <div className="flex items-center gap-3">
                  <Mail className="h-6 w-6 text-brand-blue shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-blue">Email Inquiry</span>
                    <div className="font-bold text-sm text-foreground group-hover:text-brand-orange transition">{s.company_email}</div>
                  </div>
                </div>
              </a>
            )}
          </div>

          <form
            onSubmit={submit}
            className="rounded-xl border border-border bg-surface p-6 shadow-sm flex flex-col justify-between"
          >
            <div>
              <h3 className="font-display text-xl font-bold text-foreground">Request Security & Door Consultation</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter your details to initiate a direct WhatsApp quote or product consultation with {companyName}.
              </p>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Your Full Name</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Arc. Johnson / Engr. Musa"
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-brand-orange focus:bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Phone / WhatsApp Number</label>
                  <input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0706 349 2581"
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-brand-orange focus:bg-surface"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                disabled={busy}
                className="w-full rounded-lg bg-brand-orange px-5 py-3 text-sm font-bold text-canvas hover:bg-brand-orange-hover disabled:opacity-60 transition shadow-sm"
              >
                {busy ? "Connecting…" : "Send WhatsApp Request"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
