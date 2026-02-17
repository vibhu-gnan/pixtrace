import Link from 'next/link';
import Navigation from '@/components/Navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import { LazyImage } from '@/components/UI/LoadingStates';
import type { FeatureCard } from '@/types';
import { scrollToElement } from '@/lib/utils';

const featureCards: FeatureCard[] = [
  {
    title: 'Smart Organization',
    description: 'Organize thousands of photos into beautiful albums effortlessly. Create curated collections that highlight the best moments.',
    icon: 'grid_view',
    color: 'primary',
  },
  {
    title: 'Original Quality',
    description: 'We never compress your art. Deliver full-resolution RAW conversions or high-res JPEGs directly to clients without quality loss.',
    icon: 'high_quality',
    color: 'emerald',
    badge: '48MP SUPPORTED',
  },
  {
    title: 'Privacy First',
    description: 'GDPR compliant galleries. Guests only see their own photos if enabled, or access secured public albums with PIN protection.',
    icon: 'security',
    color: 'purple',
  },
  {
    title: 'Instant Sharing',
    description: 'Generate unique QR codes for each event. Print them on table cards and let guests start uploading or downloading immediately.',
    icon: 'qr_code_2',
    color: 'orange',
  },
];

export default function Home() {
  return (
    <ErrorBoundary>
      <div className="bg-background-light dark:bg-background-dark font-display text-slate-800 dark:text-slate-200 antialiased overflow-x-hidden">
        <Navigation />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/20 rounded-full blur-[120px] -z-10 opacity-40 pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-primary mb-6">
              <span className="relative flex h-2 w-2" aria-label="Live indicator">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              New Gallery Engine v2.0 Live
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
              Your Event Memories, <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">Delivered Beautifully.</span>
            </h1>
            
            <p className="text-lg text-slate-400 mb-8 max-w-lg leading-relaxed">
              The premium gallery platform that delivers original quality photos to your guests instantly via simple QR codes.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                href="/sign-in"
                className="px-8 py-4 bg-primary hover:bg-blue-600 text-white font-semibold rounded-lg transition-all shadow-[0_0_30px_-10px_rgba(43,108,238,0.6)] flex items-center justify-center gap-2 group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-dark"
                aria-label="Login to PIXTRACE"
              >
                Login
                <span className="material-icons text-sm group-hover:translate-x-1 transition-transform" aria-hidden="true">arrow_forward</span>
              </Link>
              
              <Link
                href="/gallery"
                className="px-8 py-4 glass-panel text-white font-semibold rounded-lg hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                aria-label="View demo gallery"
              >
                <span className="material-icons text-primary" aria-hidden="true">play_circle</span>
                View Demo
              </Link>
            </div>
            
            <div className="mt-12 flex items-center gap-4 text-sm text-slate-500">
              <div className="flex -space-x-3">
                <div className="w-10 h-10 rounded-full border-2 border-background-dark bg-gradient-to-br from-blue-500 to-purple-500" />
                <div className="w-10 h-10 rounded-full border-2 border-background-dark bg-gradient-to-br from-purple-500 to-pink-500" />
                <div className="w-10 h-10 rounded-full border-2 border-background-dark bg-gradient-to-br from-pink-500 to-orange-500" />
              </div>
              <p>Trusted by 2,000+ Photographers</p>
            </div>
          </div>
          
          {/* Hero Gallery Grid - Desktop Only with Gradient Placeholders */}
          <div className="relative h-[600px] w-full hidden lg:block perspective-1000">
            <div className="absolute inset-0 grid grid-cols-3 gap-4 transform rotate-y-12 rotate-x-6 scale-90 opacity-80 grid-mask">
              <div className="flex flex-col gap-4 -mt-12">
                <div className="relative rounded-xl overflow-hidden h-64 group bg-gradient-to-br from-blue-600 to-purple-600">
                  <div className="w-full h-full flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                    <span className="material-icons text-6xl text-white/40" aria-hidden="true">image</span>
                  </div>
                  <div className="absolute inset-0 bg-primary/10"></div>
                </div>
                <div className="relative rounded-xl overflow-hidden h-48 group bg-gradient-to-br from-purple-600 to-pink-600">
                  <div className="w-full h-full flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                    <span className="material-icons text-6xl text-white/40" aria-hidden="true">image</span>
                  </div>
                </div>
                <div className="relative rounded-xl overflow-hidden h-64 group bg-gradient-to-br from-pink-600 to-orange-600">
                  <div className="w-full h-full flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                    <span className="material-icons text-6xl text-white/40" aria-hidden="true">image</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-4">
                <div className="relative rounded-xl overflow-hidden h-56 group border border-primary/30 shadow-[0_0_30px_rgba(43,108,238,0.2)] bg-gradient-to-br from-emerald-600 to-cyan-600">
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="material-icons text-6xl text-white/40" aria-hidden="true">image</span>
                  </div>
                  <div className="absolute bottom-4 left-4 bg-background-dark/80 backdrop-blur px-3 py-1 rounded text-xs text-primary font-mono border border-primary/20">PREMIUM GALLERY</div>
                </div>
                <div className="relative rounded-xl overflow-hidden h-72 group bg-gradient-to-br from-cyan-600 to-blue-600">
                  <div className="w-full h-full flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                    <span className="material-icons text-6xl text-white/40" aria-hidden="true">image</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-4 -mt-8">
                <div className="relative rounded-xl overflow-hidden h-48 group bg-gradient-to-br from-indigo-600 to-blue-600">
                  <div className="w-full h-full flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                    <span className="material-icons text-6xl text-white/40" aria-hidden="true">image</span>
                  </div>
                </div>
                <div className="relative rounded-xl overflow-hidden h-80 group bg-gradient-to-br from-slate-700 to-slate-800">
                  <div className="w-full h-full flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                    <span className="material-icons text-6xl text-white/40" aria-hidden="true">image</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Elegant Gallery Management</h2>
            <p className="text-slate-400">Everything you need to deliver a premium experience to your clients.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-1 md:col-span-2 glass-panel rounded-2xl p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-32 bg-primary/10 blur-[80px] rounded-full group-hover:bg-primary/20 transition-all duration-500"></div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="mb-8">
                  <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-6 text-primary">
                    <span className="material-icons text-2xl" aria-hidden="true">grid_view</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Smart Organization</h3>
                  <p className="text-slate-400 max-w-md">Organize thousands of photos into beautiful albums effortlessly. Create curated collections that highlight the best moments.</p>
                </div>
                <div className="w-full h-48 rounded-xl bg-background-dark/50 border border-white/5 relative overflow-hidden flex items-center justify-center px-8">
                  <div className="grid grid-cols-4 gap-2 w-full max-w-md opacity-75">
                    <div className="h-20 bg-slate-700/50 rounded border border-slate-600/50 w-full transform translate-y-2"></div>
                    <div className="h-20 bg-slate-700/50 rounded border border-slate-600/50 w-full transform -translate-y-2"></div>
                    <div className="h-20 bg-primary/20 rounded border border-primary/50 w-full transform translate-y-4 shadow-[0_0_15px_rgba(43,108,238,0.3)]"></div>
                    <div className="h-20 bg-slate-700/50 rounded border border-slate-600/50 w-full transform translate-y-1"></div>
                    <div className="h-16 bg-slate-700/50 rounded border border-slate-600/50 w-full transform translate-y-2"></div>
                    <div className="h-16 bg-slate-700/50 rounded border border-slate-600/50 w-full transform -translate-y-2"></div>
                    <div className="h-16 bg-slate-700/50 rounded border border-slate-600/50 w-full transform translate-y-4"></div>
                    <div className="h-16 bg-slate-700/50 rounded border border-slate-600/50 w-full transform translate-y-1"></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="col-span-1 glass-panel rounded-2xl p-8 relative overflow-hidden group">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-6 text-emerald-400 group-hover:scale-110 transition-transform">
                <span className="material-icons text-2xl" aria-hidden="true">high_quality</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Original Quality</h3>
              <p className="text-slate-400 text-sm mb-6">We never compress your art. Deliver full-resolution RAW conversions or high-res JPEGs directly to clients without quality loss.</p>
              <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between text-xs font-mono text-emerald-400">
                <span>48MP SUPPORTED</span>
                <span className="material-icons text-base" aria-hidden="true">check_circle</span>
              </div>
            </div>
            
            <div className="col-span-1 glass-panel rounded-2xl p-8 relative overflow-hidden group">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-6 text-purple-400 group-hover:scale-110 transition-transform">
                <span className="material-icons text-2xl" aria-hidden="true">security</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Privacy First</h3>
              <p className="text-slate-400 text-sm">GDPR compliant galleries. Guests only see their own photos if enabled, or access secured public albums with PIN protection.</p>
            </div>
            
            <div className="col-span-1 md:col-span-2 glass-panel rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent skew-x-12 translate-x-full group-hover:translate-x-0 transition-transform duration-1000"></div>
              <div className="flex-1">
                <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center mb-6 text-orange-400">
                  <span className="material-icons text-2xl" aria-hidden="true">qr_code_2</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Instant Sharing</h3>
                <p className="text-slate-400">Generate unique QR codes for each event. Print them on table cards and let guests start uploading or downloading immediately.</p>
              </div>
              <div className="w-32 h-32 bg-white p-2 rounded-lg shadow-2xl shrink-0">
                <div className="w-full h-full border-2 border-black border-dashed flex items-center justify-center">
                  <span className="material-icons text-4xl text-black" aria-hidden="true">qr_code</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-24 bg-background-dark relative border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-primary font-bold tracking-widest text-sm uppercase">Workflow</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">Simplicity by Design</h2>
          </div>
          
          <div className="relative">
            <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="relative flex flex-col items-center text-center group">
                <div className="w-24 h-24 rounded-full bg-background-dark border-4 border-slate-800 flex items-center justify-center z-10 mb-6 group-hover:border-primary transition-colors duration-300 shadow-xl">
                  <span className="material-icons text-3xl text-slate-400 group-hover:text-white" aria-hidden="true">cloud_upload</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">1. Upload</h3>
                <p className="text-slate-400 text-sm px-4">Drag and drop thousands of photos. Our bulk uploader handles RAW and JPEG efficiently.</p>
              </div>
              
              <div className="relative flex flex-col items-center text-center group">
                <div className="w-24 h-24 rounded-full bg-background-dark border-4 border-slate-800 flex items-center justify-center z-10 mb-6 group-hover:border-primary transition-colors duration-300 shadow-xl">
                  <span className="material-icons text-3xl text-slate-400 group-hover:text-white animate-pulse" aria-hidden="true">auto_awesome_mosaic</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">2. Organize</h3>
                <p className="text-slate-400 text-sm px-4">Our system automatically arranges your photos into beautiful, responsive galleries.</p>
              </div>
              
              <div className="relative flex flex-col items-center text-center group">
                <div className="w-24 h-24 rounded-full bg-background-dark border-4 border-slate-800 flex items-center justify-center z-10 mb-6 group-hover:border-primary transition-colors duration-300 shadow-xl">
                  <span className="material-icons text-3xl text-slate-400 group-hover:text-white" aria-hidden="true">qr_code_scanner</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">3. Share</h3>
                <p className="text-slate-400 text-sm px-4">Guests scan a QR code and browse their event gallery.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5"></div>
        <div className="absolute bottom-0 left-0 w-full h-full bg-gradient-to-t from-background-dark to-transparent"></div>
        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to modernize your workflow?</h2>
          <p className="text-xl text-slate-400 mb-10">Join thousands of event photographers saving hours of sorting time every week.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-in"
              className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-blue-600 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-primary/50 text-lg"
              aria-label="Login to PIXTRACE"
            >
              Login Now
            </Link>
            <a
              href="tel:8688146351"
              className="w-full sm:w-auto px-8 py-4 bg-transparent border border-slate-600 text-slate-300 font-semibold rounded-lg hover:bg-white/5 hover:text-white hover:border-white transition-all text-lg"
              aria-label="Call sales team at 8688146351"
            >
              Contact Sales
            </a>
          </div>
          <p className="mt-6 text-sm text-slate-500">No credit card required for trial • Cancel anytime</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0b1019] border-t border-white/5 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                  <span className="material-icons text-white text-xs" aria-hidden="true">filter_center_focus</span>
                </div>
                <span className="text-xl font-bold text-white">PIXTRACE</span>
              </div>
              <p className="text-slate-500 text-sm max-w-xs mb-6">
                The advanced photography platform for events, weddings, and corporate gatherings.
              </p>
              <div className="flex gap-4">
                <a className="text-slate-400 hover:text-primary transition-colors" href="#" aria-label="Follow on Facebook">
                  <span className="material-icons" aria-hidden="true">facebook</span>
                </a>
                <a className="text-slate-400 hover:text-primary transition-colors" href="#" aria-label="Follow on Instagram">
                  <span className="material-icons" aria-hidden="true">photo_camera</span>
                </a>
                <a className="text-slate-400 hover:text-primary transition-colors" href="tel:8688146351" aria-label="Call PIXTRACE support">
                  <span className="material-icons" aria-hidden="true">phone</span>
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
                <Link className="hover:text-white transition-colors focus:outline-none focus:text-white" href="#features">Features</Link>
                <Link className="hover:text-white transition-colors focus:outline-none focus:text-white" href="/pricing">Pricing</Link>
              </div>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a className="hover:text-primary" href="#">API</a></li>
                <li><a className="hover:text-primary" href="#">Integrations</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a className="hover:text-primary" href="#">About</a></li>
                <li><a className="hover:text-primary" href="#">Blog</a></li>
                <li><a className="hover:text-primary" href="#">Careers</a></li>
                <li><a className="hover:text-primary" href="#">Legal</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a className="hover:text-primary" href="#">Help Center</a></li>
                <li><a className="hover:text-primary" href="#">Status</a></li>
                <li><a className="hover:text-primary" href="#">Contact</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-600 text-sm">© 2023 PIXTRACE Inc. All rights reserved.</p>
            <div className="flex gap-6 text-sm text-slate-600">
              <a className="hover:text-slate-400" href="#">Privacy Policy</a>
              <a className="hover:text-slate-400" href="#">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
      </div>
    </ErrorBoundary>
  );
}
