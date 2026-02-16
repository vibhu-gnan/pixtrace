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

    try {
        const { eventHash } = await params;
        const theme = await getGalleryTheme(eventHash);
        logoUrl = theme.logoUrl;
        logoDisplay = theme.logoDisplay;
    } catch {
        // Fetch failed — fall back to simple spinner (never block rendering)
    }

    return (
        <Suspense fallback={<GalleryLoadingScreen logoUrl={logoUrl} logoDisplay={logoDisplay} />}>
            {children}
        </Suspense>
    );
}
