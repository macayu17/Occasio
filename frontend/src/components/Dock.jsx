import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'motion/react';
import { Children, cloneElement, useEffect, useRef, useState } from 'react';

function DockItem({ children, className = '', onClick, mouseX, spring, distance, magnification, baseItemSize }) {
    const ref = useRef(null);
    const isHovered = useMotionValue(0);

    const mouseDistance = useTransform(mouseX, val => {
        const rect = ref.current?.getBoundingClientRect() ?? { x: 0, width: baseItemSize };
        return val - rect.x - baseItemSize / 2;
    });

    const targetSize = useTransform(mouseDistance, [-distance, 0, distance], [baseItemSize, magnification, baseItemSize]);
    const size = useSpring(targetSize, spring);

    return (
        <motion.div
            ref={ref}
            style={{ width: size, height: size }}
            onHoverStart={() => isHovered.set(1)}
            onHoverEnd={() => isHovered.set(0)}
            onFocus={() => isHovered.set(1)}
            onBlur={() => isHovered.set(0)}
            onClick={onClick}
            className={`relative inline-flex items-center justify-center rounded-full bg-[#18181b] border border-white/10 shadow-lg hover:border-[#E23744]/50 transition-colors cursor-pointer ${className}`}
            tabIndex={0}
            role="button"
        >
            {Children.map(children, child => cloneElement(child, { isHovered }))}
        </motion.div>
    );
}

function DockLabel({ children, className = '', ...rest }) {
    const { isHovered } = rest;
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const unsubscribe = isHovered?.on('change', latest => {
            setIsVisible(latest === 1);
        });
        return () => unsubscribe?.();
    }, [isHovered]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: 1, y: -10 }}
                    exit={{ opacity: 0, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`${className} absolute -top-8 left-1/2 w-max whitespace-pre rounded-lg border border-white/10 bg-[#18181b] px-3 py-1.5 text-xs font-medium text-white shadow-xl`}
                    style={{ x: '-50%' }}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function DockIcon({ children, className = '', isHovered }) {
    return <div className={`flex items-center justify-center text-gray-300 ${className}`}>{children}</div>;
}

export default function Dock({
    items,
    className = '',
    spring = { mass: 0.1, stiffness: 150, damping: 12 },
    magnification = 70,
    distance = 140,
    panelHeight = 68,
    baseItemSize = 50
}) {
    const mouseX = useMotionValue(Infinity);
    const isHovered = useMotionValue(0);

    return (
        <motion.div
            onMouseMove={({ pageX }) => {
                isHovered.set(1);
                mouseX.set(pageX);
            }}
            onMouseLeave={() => {
                isHovered.set(0);
                mouseX.set(Infinity);
            }}
            className={`${className} flex items-end justify-center gap-3 rounded-2xl border border-white/10 bg-[#09090b]/90 backdrop-blur-xl px-4 py-3 shadow-2xl`}
            style={{ height: panelHeight }}
        >
            {items.map((item, index) => (
                <DockItem
                    key={index}
                    onClick={item.onClick}
                    className={item.active ? 'ring-2 ring-[#E23744] ring-offset-2 ring-offset-[#09090b]' : ''}
                    mouseX={mouseX}
                    spring={spring}
                    distance={distance}
                    magnification={magnification}
                    baseItemSize={baseItemSize}
                >
                    <DockIcon>{item.icon}</DockIcon>
                    <DockLabel>{item.label}</DockLabel>
                </DockItem>
            ))}
        </motion.div>
    );
}
