'use client';

import { useState, useEffect } from 'react';

interface HeroSlideshowProps {
    images: string[];
}

export function HeroSlideshow({ images }: HeroSlideshowProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (images.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % images.length);
        }, 5000); // Change slide every 5 seconds

        return () => clearInterval(interval);
    }, [images.length]);

    if (images.length === 0) return null;

    return (
        <div className="absolute inset-0 w-full h-full overflow-hidden bg-black">
            {images.map((url, index) => (
                <div
                    key={url} // Using URL as key assuming uniqueness in this context
                    className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${index === currentIndex ? 'opacity-100' : 'opacity-0'
                        }`}
                >
                    <img
                        src={url}
                        alt="Gallery cover"
                        className={`w-full h-full object-cover transform transition-transform duration-[6000ms] ease-linear ${index === currentIndex ? 'scale-110' : 'scale-100'
                            }`}
                        style={{ filter: 'brightness(0.7)' }} // Darken slightly for text readability
                    />
                </div>
            ))}

            {/* Optional: Dots indicators */}
            {images.length > 1 && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {images.map((_, idx) => (
                        <div
                            key={idx}
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-white w-4' : 'bg-white/50'
                                }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
