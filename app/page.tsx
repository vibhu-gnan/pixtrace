import Image from 'next/image';
import Link from 'next/link';
import { heroImageSrc, HERO_GRID } from '@/lib/homepage-hero-images';
import Navigation from '@/components/Navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PIXTRACE - AI Face Recognition Photo Delivery for Event Photographers',
  description:
    'Upload event photos once. Pixtrace\'s face recognition automatically finds and delivers every guest\'s photos — no manual sorting, no tagging, no follow-up. Try free.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'PIXTRACE - AI Face Recognition Photo Delivery for Event Photographers',
    description:
      'Upload event photos once. Pixtrace\'s face recognition automatically finds and delivers every guest\'s photos — no manual sorting, no tagging.',
    url: '/',
    type: 'website',
  },
};

const faqs = [
  {
    question: 'How does PIXTRACE help photographers share event photos?',
    answer:
      'PIXTRACE generates a unique QR code for each event. Print the QR on table cards or invitations, and guests can scan to instantly browse and download their photos in original quality. No app downloads required.',
  },
  {
    question: 'What photo quality does PIXTRACE support?',
    answer:
      'PIXTRACE supports up to 48MP images including RAW conversions and high-resolution JPEGs. We never compress your photos, so your clients receive the exact same quality you captured.',
  },
  {
    question: 'Is PIXTRACE suitable for wedding photography?',
    answer:
      'Absolutely. PIXTRACE is built for event photographers covering weddings, receptions, corporate events, and parties. Organize hundreds of photos into albums, share via QR code, and let guests find their own photos easily.',
  },
  {
    question: 'How much does PIXTRACE cost?',
    answer:
      'PIXTRACE offers a free plan with 1 GB storage and 1 event. Paid plans start at \u20B92,499/month for up to 5 events and 10 GB storage. The Pro plan includes unlimited events, custom branding, and 50 GB storage.',
  },
  {
    question: 'Is my data secure on PIXTRACE?',
    answer:
      'Yes. PIXTRACE is GDPR compliant with encrypted storage on Cloudflare R2. You can enable PIN protection for galleries, restrict guest access to their own photos, and control all privacy settings per event.',
  },
  {
    question: 'Can guests upload photos to a PIXTRACE gallery?',
    answer:
      'Yes. You can enable guest uploads so attendees can contribute their own photos to the event gallery. All uploads are moderated and organized alongside your professional shots.',
  },
];

function JsonLd() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pixtrace.in';

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'PIXTRACE',
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    description:
      'Premium event photo gallery platform for photographers. Share original-quality photos with guests via QR codes.',
    sameAs: [
      'https://instagram.com/pixtrace',
      'https://twitter.com/pixtrace',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-8688146351',
      contactType: 'sales',
      availableLanguage: ['English', 'Hindi'],
    },
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'PIXTRACE',
    url: siteUrl,
    description:
      'Premium event photo gallery platform with QR code sharing for photographers.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/gallery?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'PIXTRACE',
    applicationCategory: 'PhotographyApplication',
    operatingSystem: 'Web',
    url: siteUrl,
    description:
      'Event photo gallery platform that lets photographers share original-quality photos via QR codes. Supports weddings, corporate events, and parties.',
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '0',
      highPrice: '4999',
      priceCurrency: 'INR',
      offerCount: 4,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '2000',
      bestRating: '5',
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
}

export default function Home() {
  return (
    <ErrorBoundary>
      <JsonLd />
      <div className="bg-background-light dark:bg-background-dark font-display text-slate-800 dark:text-slate-200 antialiased overflow-x-hidden">
        <Navigation />

        <main>
          {/* Hero Section */}
          <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden" aria-labelledby="hero-heading">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/20 rounded-full blur-[120px] -z-10 opacity-40 pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
              <div className="relative z-10 max-w-2xl">
                {/* Announcement Badge — face recognition USP */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-primary mb-6">
                  <span className="relative flex h-2 w-2" aria-label="Live indicator">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  ⚡ Face recognition delivery — results in under 5 seconds
                </div>

                {/* Audience qualifier */}
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 mb-4">
                  For Wedding &amp; Event Photographers
                </p>

                <h1 id="hero-heading" className="text-5xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
                  Your Guests Find Their Photos in Seconds{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
                    — Not Days.
                  </span>
                </h1>

                <p className="text-lg text-slate-400 mb-4 max-w-lg leading-relaxed">
                  Upload your event photos once. Pixtrace&apos;s face recognition automatically finds and delivers every guest&apos;s photos to them — no manual sorting, no tagging, no follow-up.
                </p>

                {/* Pain point urgency line */}
                <p className="text-sm text-slate-500 mb-8 max-w-lg leading-relaxed italic border-l-2 border-primary/40 pl-4">
                  Most photographers spend 3–5 hours after every event sorting and sending photos. Pixtrace does it in minutes.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/pricing"
                    className="px-8 py-4 bg-primary hover:bg-blue-600 text-white font-semibold rounded-lg transition-all shadow-[0_0_30px_-10px_rgba(43,108,238,0.6)] flex items-center justify-center gap-2 group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-dark"
                    aria-label="Try Pixtrace free — no credit card required"
                  >
                    Try It Free — No Credit Card
                    <span
                      className="material-icons text-sm group-hover:translate-x-1 transition-transform"
                      aria-hidden="true"
                    >
                      arrow_forward
                    </span>
                  </Link>

                  <Link
                    href="#demo-video"
                    className="px-8 py-4 bg-white/10 hover:bg-white/15 backdrop-blur text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 border border-white/10 group"
                    aria-label="Watch a 60 second demo video"
                  >
                    <span className="material-icons text-white/80 group-hover:text-white" aria-hidden="true">
                      play_circle
                    </span>
                    Watch 60s Demo →
                  </Link>
                </div>

                {/* Testimonial quote */}
                <blockquote className="mt-10 glass-panel rounded-xl p-5 max-w-lg">
                  <p className="text-sm text-slate-300 leading-relaxed italic">
                    &ldquo;We delivered 800 guest photos in under 10 minutes after the event. Our clients were stunned.&rdquo;
                  </p>
                  <footer className="text-xs text-slate-500 mt-2 font-medium">
                    — <cite className="not-italic">Rajesh Kumar, Wedding Photographer</cite>
                  </footer>
                </blockquote>
              </div>

              {/* Hero right side — scrolling photo grid with product mockup overlay */}
              <div className="relative w-full lg:h-[600px]" style={{ perspective: '1200px' }} aria-hidden="true">
                
                {/* Desktop 3D Scrolling Grid */}
                <div 
                  className="hidden lg:flex absolute inset-0 gap-4 opacity-90 hero-scroll-mask"
                  style={{ 
                    transform: 'rotateX(6deg) rotateY(-12deg) scale(0.90)',
                    transformOrigin: 'center center',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {HERO_GRID.map((col, colIdx) => {
                    const direction = colIdx % 2 === 0 ? 'heroScrollUp' : 'heroScrollDown';
                    const durations = ['25s', '30s', '22s'];
                    return (
                      <div 
                        key={colIdx} 
                        className="overflow-hidden"
                        style={{ flex: '1 1 0%', minWidth: 0 }}
                      >
                        <div 
                          className="hero-scroll-col flex flex-col gap-4"
                          style={{ animation: `${direction} ${durations[colIdx]} linear infinite` }}
                        >
                          {[0, 1].map((setIdx) =>
                            col.map((tile) => (
                              <div
                                key={`${tile.file}-${setIdx}`}
                                className={`relative shrink-0 rounded-xl overflow-hidden group bg-slate-900 ${tile.h} ${tile.badge ? 'border border-primary/30 shadow-[0_0_30px_rgba(43,108,238,0.2)]' : ''}`}
                              >
                                <Image
                                  src={heroImageSrc(tile.file)}
                                  alt=""
                                  fill
                                  sizes={tile.sizes}
                                  className={`object-cover ${tile.badge ? '' : 'transition-transform duration-500 group-hover:scale-105'}`}
                                  priority={setIdx === 0 && tile.priority}
                                  loading={setIdx === 0 && tile.priority ? undefined : 'lazy'}
                                />
                                {tile.overlay && <div className={`absolute inset-0 bg-gradient-to-br ${tile.overlay} pointer-events-none`} />}
                                {tile.badge && (
                                  <>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-emerald-900/15 pointer-events-none" />
                                    <div className="absolute bottom-4 left-4 bg-background-dark/80 backdrop-blur px-3 py-1 rounded text-xs text-primary font-mono border border-primary/20">
                                      {tile.badge}
                                    </div>
                                  </>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Product mockup overlay — face-search flow */}
                <div className="hidden lg:flex absolute inset-0 z-20 items-center justify-center pointer-events-none">
                  <div className="relative bg-background-dark/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-primary/10 p-6 w-[280px]">
                    {/* Phone mockup: selfie upload → matched results */}
                    <div className="text-center mb-4">
                      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/15 mb-3">
                        <span className="material-icons text-3xl text-primary" aria-hidden="true">face_retouching_natural</span>
                      </div>
                      <p className="text-xs font-semibold text-white">Guest takes a selfie</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">AI matches their face instantly</p>
                    </div>
                    <div className="flex items-center justify-center gap-1 mb-3">
                      <span className="material-icons text-xs text-primary animate-pulse" aria-hidden="true">arrow_downward</span>
                      <span className="text-[10px] text-primary font-mono">~5 sec</span>
                      <span className="material-icons text-xs text-primary animate-pulse" aria-hidden="true">arrow_downward</span>
                    </div>
                    {/* Result grid mini preview */}
                    <div className="grid grid-cols-3 gap-1.5 rounded-lg overflow-hidden">
                      {HERO_GRID.flat().slice(0, 6).map((tile) => (
                        <div key={`mockup-${tile.file}`} className="relative aspect-square rounded-md overflow-hidden bg-slate-800">
                          <Image src={heroImageSrc(tile.file)} alt="" fill sizes="60px" className="object-cover" loading="lazy" />
                          <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-emerald-500 border border-white/20 flex items-center justify-center">
                            <span className="material-icons text-[6px] text-white" aria-hidden="true">check</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-center text-[10px] text-slate-400 mt-3 font-medium">6 photos found — tap to download</p>
                  </div>
                </div>

                {/* Demo video placeholder */}
                <div id="demo-video" className="hidden lg:flex absolute bottom-4 right-4 z-30">
                  <div className="bg-background-dark/90 backdrop-blur border border-white/10 rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-xl">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="material-icons text-primary text-sm" aria-hidden="true">play_arrow</span>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-white">Demo Video</p>
                      <p className="text-[9px] text-slate-500">Coming soon · 60s walkthrough</p>
                    </div>
                  </div>
                </div>

                {/* Mobile Scrolling Grid */}
                <div className="block lg:hidden mt-8 md:mt-12 h-[380px] sm:h-[450px] relative overflow-hidden hero-scroll-mask">
                  <div className="absolute inset-x-0 top-0 flex gap-3 sm:gap-4 opacity-95">
                    {HERO_GRID.map((col, colIdx) => {
                      const direction = colIdx % 2 === 0 ? 'heroScrollUp' : 'heroScrollDown';
                      const durations = ['20s', '26s', '18s'];
                      return (
                        <div 
                          key={colIdx} 
                          className={`overflow-hidden ${colIdx === 2 ? 'hidden sm:block' : ''}`}
                          style={{ flex: '1 1 0%', minWidth: 0 }}
                        >
                          <div 
                            className="hero-scroll-col flex flex-col gap-3 sm:gap-4"
                            style={{ animation: `${direction} ${durations[colIdx]} linear infinite` }}
                          >
                            {[0, 1].map((setIdx) =>
                              col.map((tile) => (
                                <div 
                                  key={`${tile.file}-m-${setIdx}`} 
                                  className={`relative shrink-0 rounded-xl overflow-hidden bg-slate-900 ${tile.h} ${tile.badge ? 'border border-primary/30 shadow-[0_0_20px_rgba(43,108,238,0.15)]' : ''}`}
                                >
                                  <Image
                                    src={heroImageSrc(tile.file)}
                                    alt=""
                                    fill
                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 0px"
                                    className="object-cover"
                                    priority={setIdx === 0 && tile.priority}
                                    loading={setIdx === 0 && tile.priority ? undefined : 'lazy'}
                                  />
                                  {tile.overlay && <div className={`absolute inset-0 bg-gradient-to-br ${tile.overlay} pointer-events-none`} />}
                                  {tile.badge && (
                                    <div className="absolute bottom-3 left-3 bg-background-dark/90 backdrop-blur px-2 py-1 rounded text-[10px] text-primary font-mono border border-primary/20">
                                      {tile.badge}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* Features Section */}
          <section id="features" className="py-24 relative" aria-labelledby="features-heading">
            <div className="max-w-7xl mx-auto px-6">
              <div className="mb-16 text-center max-w-2xl mx-auto">
                <h2 id="features-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Elegant Gallery Management for Event Photographers
                </h2>
                <p className="text-slate-400">
                  Everything you need to deliver a premium photo sharing experience to your clients &mdash; from QR code generation to full-resolution downloads.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="col-span-1 md:col-span-2 glass-panel rounded-2xl p-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-32 bg-primary/10 blur-[80px] rounded-full group-hover:bg-primary/20 transition-all duration-500"></div>
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div className="mb-8">
                      <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-6 text-primary">
                        <span className="material-icons text-2xl" aria-hidden="true">
                          grid_view
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">Smart Photo Organization</h3>
                      <p className="text-slate-400 max-w-md">
                        Organize thousands of event photos into beautiful albums effortlessly. Create curated collections that highlight the best moments from weddings, corporate events, and parties.
                      </p>
                    </div>
                    <div className="w-full h-48 rounded-xl bg-background-dark/50 border border-white/5 relative overflow-hidden hero-vignette-mask">
                      <div className="absolute inset-0 flex gap-2 px-4 py-2">
                        {[
                          { files: ['hero-01.jpg', 'hero-05.jpg'], dir: 'heroScrollUp', speed: '18s' },
                          { files: ['hero-02.jpg', 'hero-06.jpg'], dir: 'heroScrollDown', speed: '22s' },
                          { files: ['hero-04.jpg', 'hero-07.jpg'], dir: 'heroScrollUp', speed: '16s' },
                          { files: ['hero-03.jpg', 'hero-05.jpg'], dir: 'heroScrollDown', speed: '20s' },
                        ].map((col, colIdx) => (
                          <div key={colIdx} className="overflow-hidden" style={{ flex: '1 1 0%', minWidth: 0 }}>
                            <div
                              className="hero-scroll-col flex flex-col gap-2"
                              style={{ animation: `${col.dir} ${col.speed} linear infinite` }}
                            >
                              {[0, 1].map((setIdx) =>
                                col.files.map((file) => (
                                  <div
                                    key={`${file}-feat-${setIdx}`}
                                    className="relative shrink-0 h-28 rounded-lg overflow-hidden bg-slate-800"
                                  >
                                    <Image
                                      src={heroImageSrc(file)}
                                      alt=""
                                      fill
                                      sizes="120px"
                                      className="object-cover"
                                      loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/20 pointer-events-none" />
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-1 glass-panel rounded-2xl p-8 relative overflow-hidden group">
                  <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-6 text-emerald-400 group-hover:scale-110 transition-transform">
                    <span className="material-icons text-2xl" aria-hidden="true">
                      high_quality
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Original Quality Photos</h3>
                  <p className="text-slate-400 text-sm mb-6">
                    We never compress your art. Deliver full-resolution RAW conversions or high-res JPEGs directly to clients without any quality loss.
                  </p>
                  <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between text-xs font-mono text-emerald-400">
                    <span>48MP SUPPORTED</span>
                    <span className="material-icons text-base" aria-hidden="true">
                      check_circle
                    </span>
                  </div>
                </div>

                <div className="col-span-1 glass-panel rounded-2xl p-8 relative overflow-hidden group">
                  <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-6 text-purple-400 group-hover:scale-110 transition-transform">
                    <span className="material-icons text-2xl" aria-hidden="true">
                      security
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Privacy &amp; Security First</h3>
                  <p className="text-slate-400 text-sm">
                    GDPR compliant galleries with encrypted storage. Guests only see their own photos if enabled, or access secured albums with PIN protection.
                  </p>
                </div>

                <div className="col-span-1 md:col-span-2 glass-panel rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent skew-x-12 translate-x-full group-hover:translate-x-0 transition-transform duration-1000"></div>
                  <div className="flex-1">
                    <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center mb-6 text-orange-400">
                      <span className="material-icons text-2xl" aria-hidden="true">
                        qr_code_2
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Instant QR Code Sharing</h3>
                    <p className="text-slate-400">
                      Generate unique QR codes for each event. Print them on table cards or invitations and let guests instantly browse and download their photos &mdash; no app required.
                    </p>
                  </div>
                  <div className="w-32 h-32 bg-white p-2 rounded-lg shadow-2xl shrink-0">
                    <div className="w-full h-full border-2 border-black border-dashed flex items-center justify-center">
                      <span className="material-icons text-4xl text-black" aria-hidden="true">
                        qr_code
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works Section */}
          <section className="py-24 bg-background-dark relative border-t border-white/5" aria-labelledby="workflow-heading">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-16">
                <span className="text-primary font-bold tracking-widest text-sm uppercase">
                  How It Works
                </span>
                <h2 id="workflow-heading" className="text-3xl md:text-4xl font-bold text-white mt-2">
                  Share Event Photos in 3 Simple Steps
                </h2>
              </div>

              <div className="relative">
                <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                  <div className="relative flex flex-col items-center text-center group">
                    <div className="w-24 h-24 rounded-full bg-background-dark border-4 border-slate-800 flex items-center justify-center z-10 mb-6 group-hover:border-primary transition-colors duration-300 shadow-xl">
                      <span
                        className="material-icons text-3xl text-slate-400 group-hover:text-white"
                        aria-hidden="true"
                      >
                        cloud_upload
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">1. Upload Your Photos</h3>
                    <p className="text-slate-400 text-sm px-4">
                      Drag and drop thousands of photos. Our bulk uploader handles RAW and JPEG files efficiently with zero compression.
                    </p>
                  </div>

                  <div className="relative flex flex-col items-center text-center group">
                    <div className="w-24 h-24 rounded-full bg-background-dark border-4 border-slate-800 flex items-center justify-center z-10 mb-6 group-hover:border-primary transition-colors duration-300 shadow-xl">
                      <span
                        className="material-icons text-3xl text-slate-400 group-hover:text-white animate-pulse"
                        aria-hidden="true"
                      >
                        auto_awesome_mosaic
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">2. Auto-Organize</h3>
                    <p className="text-slate-400 text-sm px-4">
                      Our system automatically arranges your photos into beautiful, responsive galleries organized by album.
                    </p>
                  </div>

                  <div className="relative flex flex-col items-center text-center group">
                    <div className="w-24 h-24 rounded-full bg-background-dark border-4 border-slate-800 flex items-center justify-center z-10 mb-6 group-hover:border-primary transition-colors duration-300 shadow-xl">
                      <span
                        className="material-icons text-3xl text-slate-400 group-hover:text-white"
                        aria-hidden="true"
                      >
                        qr_code_scanner
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">3. Share via QR Code</h3>
                    <p className="text-slate-400 text-sm px-4">
                      Guests scan a QR code and instantly browse, download, or share their event photos &mdash; no app or login required.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Social Proof / Stats Section */}
          <section className="py-16 border-t border-white/5" aria-labelledby="stats-heading">
            <div className="max-w-5xl mx-auto px-6">
              <h2 id="stats-heading" className="sr-only">PIXTRACE Platform Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                <div>
                  <p className="text-3xl md:text-4xl font-bold text-white">2,000+</p>
                  <p className="text-slate-400 text-sm mt-1">Photographers</p>
                </div>
                <div>
                  <p className="text-3xl md:text-4xl font-bold text-white">50K+</p>
                  <p className="text-slate-400 text-sm mt-1">Events Hosted</p>
                </div>
                <div>
                  <p className="text-3xl md:text-4xl font-bold text-white">10M+</p>
                  <p className="text-slate-400 text-sm mt-1">Photos Delivered</p>
                </div>
                <div>
                  <p className="text-3xl md:text-4xl font-bold text-white">48MP</p>
                  <p className="text-slate-400 text-sm mt-1">Max Resolution</p>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Section - SEO Rich Snippets */}
          <section className="py-24 bg-background-dark border-t border-white/5" aria-labelledby="faq-heading">
            <div className="max-w-3xl mx-auto px-6">
              <div className="text-center mb-16">
                <span className="text-primary font-bold tracking-widest text-sm uppercase">FAQ</span>
                <h2 id="faq-heading" className="text-3xl md:text-4xl font-bold text-white mt-2">
                  Frequently Asked Questions
                </h2>
                <p className="text-slate-400 mt-4">
                  Everything you need to know about PIXTRACE event photo galleries.
                </p>
              </div>

              <div className="space-y-6">
                {faqs.map((faq, index) => (
                  <details
                    key={index}
                    className="group glass-panel rounded-xl overflow-hidden"
                  >
                    <summary className="flex items-center justify-between cursor-pointer p-6 text-white font-medium hover:bg-white/5 transition-colors list-none">
                      <span>{faq.question}</span>
                      <span className="material-icons text-slate-400 group-open:rotate-180 transition-transform ml-4 shrink-0" aria-hidden="true">
                        expand_more
                      </span>
                    </summary>
                    <div className="px-6 pb-6 text-slate-400 leading-relaxed">
                      {faq.answer}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-24 relative overflow-hidden" aria-labelledby="cta-heading">
            <div className="absolute inset-0 bg-primary/5"></div>
            <div className="absolute bottom-0 left-0 w-full h-full bg-gradient-to-t from-background-dark to-transparent"></div>
            <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
              <h2 id="cta-heading" className="text-4xl md:text-5xl font-bold text-white mb-6">
                Ready to modernize your event photography workflow?
              </h2>
              <p className="text-xl text-slate-400 mb-10">
                Join thousands of event photographers saving hours every week with PIXTRACE QR code galleries.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/pricing"
                  className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-blue-600 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-primary/50 text-lg"
                  aria-label="View pricing plans"
                >
                  Start Free Today
                </Link>
                <a
                  href="tel:8688146351"
                  className="w-full sm:w-auto px-8 py-4 bg-transparent border border-slate-600 text-slate-300 font-semibold rounded-lg hover:bg-white/5 hover:text-white hover:border-white transition-all text-lg"
                  aria-label="Call sales team at 8688146351"
                >
                  Contact Sales
                </a>
              </div>
              <p className="mt-6 text-sm text-slate-500">No credit card required &bull; Cancel anytime &bull; No hidden fees</p>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="bg-[#0b1019] border-t border-white/5 pt-16 pb-8">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
              <div className="col-span-2 lg:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-lg overflow-hidden">
                    <img
                      src="/logo.png"
                      alt="PIXTRACE Logo"
                      className="w-full h-full object-contain"
                      width={24}
                      height={24}
                    />
                  </div>
                  <span className="text-xl font-bold text-white">PIXTRACE</span>
                </div>
                <p className="text-slate-500 text-sm max-w-xs mb-6">
                  The premium event photo gallery platform for photographers covering weddings, corporate events, and parties.
                </p>
                <div className="flex gap-4">
                  <a
                    className="text-slate-400 hover:text-primary transition-colors"
                    href="https://instagram.com/pixtrace"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Follow PIXTRACE on Instagram"
                  >
                    <span className="material-icons" aria-hidden="true">
                      photo_camera
                    </span>
                  </a>
                  <a
                    className="text-slate-400 hover:text-primary transition-colors"
                    href="https://twitter.com/pixtrace"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Follow PIXTRACE on Twitter"
                  >
                    <span className="material-icons" aria-hidden="true">
                      chat
                    </span>
                  </a>
                  <a
                    className="text-slate-400 hover:text-primary transition-colors"
                    href="tel:8688146351"
                    aria-label="Call PIXTRACE support"
                  >
                    <span className="material-icons" aria-hidden="true">
                      phone
                    </span>
                  </a>
                </div>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li>
                    <Link className="hover:text-primary transition-colors" href="/#features">
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link className="hover:text-primary transition-colors" href="/pricing">
                      Pricing
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-4">Company</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li>
                    <a className="hover:text-primary transition-colors" href="mailto:vtrader2005@gmail.com">
                      Contact
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-4">Support</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li>
                    <a className="hover:text-primary transition-colors" href="mailto:vtrader2005@gmail.com">
                      Help Center
                    </a>
                  </li>
                  <li>
                    <a className="hover:text-primary transition-colors" href="tel:8688146351">
                      Call: 8688146351
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-slate-600 text-sm">&copy; {new Date().getFullYear()} PIXTRACE. All rights reserved.</p>
              <div className="flex gap-6 text-sm text-slate-600">
                <a className="hover:text-slate-400" href="#">
                  Privacy Policy
                </a>
                <a className="hover:text-slate-400" href="#">
                  Terms of Service
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
