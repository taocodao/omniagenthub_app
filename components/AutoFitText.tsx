// components/AutoFitText.tsx

import React, { useState, useRef, useEffect } from 'react';

interface AutoFitTextProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    containerHeight?: number;
    maxFontSize?: number;
    minFontSize?: number;
    className?: string;
    maxLines?: number;
}

const AutoFitText: React.FC<AutoFitTextProps> = ({
    children,
    containerHeight,
    maxFontSize = 24,
    minFontSize = 10,
    className,
    maxLines = 2, // Default to 2 lines
    style,
    ...rest
}) => {
    const [fontSize, setFontSize] = useState(maxFontSize);
    const textRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = textRef.current;
        if (!element) return;

        // Function to adjust font size
        const adjustFontSize = () => {
            let currentFontSize = maxFontSize;
            element.style.fontSize = `${currentFontSize}px`;
            element.style.whiteSpace = 'nowrap'; // Start with no wrapping
            element.style.overflow = 'hidden';
            element.style.textOverflow = 'ellipsis';
            element.style.lineHeight = '1.2';

            // Check if text overflows horizontally
            const isOverflowing = () => {
                return element.scrollWidth > element.clientWidth;
            };

            // Reduce font size until text fits or reaches minFontSize
            while (isOverflowing() && currentFontSize > minFontSize) {
                currentFontSize -= 1;
                element.style.fontSize = `${currentFontSize}px`;
            }

            setFontSize(currentFontSize);

            if (isOverflowing()) {
                // If text still overflows at minFontSize, allow wrapping
                element.style.whiteSpace = 'normal';
                element.style.overflow = 'hidden';
                element.style.textOverflow = 'ellipsis';
                element.style.display = '-webkit-box';
                element.style.webkitLineClamp = `${maxLines}`;
                element.style.webkitBoxOrient = 'vertical';
                element.style.wordBreak = 'break-word'; // Allow words to break
            } else {
                // If text fits, ensure no wrapping
                element.style.whiteSpace = 'nowrap';
                element.style.overflow = 'hidden';
                element.style.textOverflow = 'ellipsis';
                element.style.display = 'block';
            }
        };

        // Initialize ResizeObserver to watch for container width changes
        const resizeObserver = new ResizeObserver(() => {
            adjustFontSize();
        });

        resizeObserver.observe(element);

        // Initial adjustment
        adjustFontSize();

        // Cleanup on unmount
        return () => {
            resizeObserver.disconnect();
        };
    }, [children, maxFontSize, minFontSize, maxLines]);

    return (
        <div
            ref={textRef}
            className={className}
            style={{
                width: '100%', // Make width responsive
                fontSize: `${fontSize}px`,
                lineHeight: '1.2',
                whiteSpace: 'nowrap', // Start with no wrapping
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                ...style,
            }}
            {...rest}
        >
            {children}
        </div>
    );
};

export default AutoFitText;
