'use client';

import { useEffect, useState } from 'react';

// Pre-defined aspect ratios to mimic real photo variety
const ASPECT_RATIOS = [
    '3/4', '4/3', '3/4', '1/1', '4/5', '3/4', '4/3', '3/4',
    '4/3', '3/4', '1/1', '4/5', '3/4', '4/3', '3/4', '4/3',
];

export function GallerySkeleton({ count = 8 }: { count?: number }) {
    const [columns, setColumns] = useState(4);

    useEffect(() => {
        function updateColumns() {
            const w = window.innerWidth;
            if (w < 640) setColumns(2);
            else if (w < 768) setColumns(3);
            else setColumns(4);
        }
        updateColumns();
        window.addEventListener('resize', updateColumns);
        return () => window.removeEventListener('resize', updateColumns);
    }, []);

    // Distribute skeleton items into columns (same algorithm as real masonry grid)
    const cols: number[][] = Array.from({ length: columns }, () => []);
    for (let i = 0; i < count; i++) {
        const minCol = cols.reduce((minIdx, col, idx) =>
            col.length < cols[minIdx].length ? idx : minIdx, 0);
        cols[minCol].push(i);
    }

    return (
        <div className="flex gap-1">
            {cols.map((col, colIdx) => (
                <div key={colIdx} className="flex-1 flex flex-col gap-1">
                    {col.map((i) => (
                        <div
                            key={i}
                            className="skeleton-shimmer rounded-sm"
                            style={{ aspectRatio: ASPECT_RATIOS[i % ASPECT_RATIOS.length] }}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}
