import { Suspense } from 'react';
import { getGalleryTheme } from '@/actions/gallery-theme';
import { GalleryLoadingScreen } from '@/components/gallery/gallery-loading-screen';

type Props = {
    children: React.ReactNode;
    params: Promise<{ eventHash: string }>;
};

export default async function GalleryEventLayout({ children, params }: Props) {
    let logoUrl: string | null = null;
    let logoDisplay: 'cover_and_loading' | 'loading_only' | 'none' = 'none';
    let customPreloader: string | null = null;

    try {
        const { eventHash } = await params;
        const theme = await getGalleryTheme(eventHash);
        logoUrl = theme.logoUrl;
        logoDisplay = theme.logoDisplay;
        customPreloader = theme.customPreloader;
    } catch {
        // Fetch failed — fall back to simple spinner (never block rendering)
    }

    return (
        <Suspense fallback={<GalleryLoadingScreen logoUrl={logoUrl} logoDisplay={logoDisplay} customPreloader={customPreloader} />}>
            {children}
        </Suspense>
    );
}
