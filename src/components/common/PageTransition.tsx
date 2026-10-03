import { ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, type Location } from 'react-router-dom';
import { animate } from 'motion/mini';
import type { AnimationPlaybackControlsWithThen } from 'motion-dom';
import {
  PAGE_TRANSITION_LAYER_CONTEXT_VALUES,
  PageTransitionLayerContext,
  type LayerStatus,
} from './PageTransitionLayer';
import './PageTransition.scss';

interface PageTransitionProps {
  render: (location: Location) => ReactNode;
  getRouteOrder?: (pathname: string) => number | null;
  getTransitionVariant?: (fromPathname: string, toPathname: string) => TransitionVariant;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

// DESIGN.md: page change is a 120ms content cross-fade. No spatial motion, and instant under
// prefers-reduced-motion. The layer stack (current / exiting / stacked) is kept so auth-file
// sub-pages still preserve the parent page while it is covered.
const CROSS_FADE_DURATION = 0.12;
const crossFadeEase = (progress: number) => progress;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const clearLayerStyles = (element: HTMLElement | null) => {
  if (!element) return;
  element.style.removeProperty('transform');
  element.style.removeProperty('opacity');
};

type Layer = {
  key: string;
  location: Location;
  status: LayerStatus;
};

type TransitionDirection = 'forward' | 'backward';

type TransitionVariant = 'vertical' | 'ios';

export function PageTransition({
  render,
  getRouteOrder,
  getTransitionVariant,
  scrollContainerRef,
}: PageTransitionProps) {
  const location = useLocation();
  const currentLayerRef = useRef<HTMLDivElement>(null);
  const exitingLayerRef = useRef<HTMLDivElement>(null);
  const transitionDirectionRef = useRef<TransitionDirection>('forward');
  const transitionVariantRef = useRef<TransitionVariant>('vertical');
  const exitScrollOffsetRef = useRef(0);
  const enterScrollOffsetRef = useRef(0);
  const scrollPositionsRef = useRef(new Map<string, number>());
  const nextLayersRef = useRef<Layer[] | null>(null);

  const [isAnimating, setIsAnimating] = useState(false);
  const [layers, setLayers] = useState<Layer[]>(() => [
    {
      key: location.key,
      location,
      status: 'current',
    },
  ]);
  const currentLayer =
    layers.find((layer) => layer.status === 'current') ?? layers[layers.length - 1];
  const currentLayerKey = currentLayer?.key ?? location.key;
  const currentLayerPathname = currentLayer?.location.pathname;

  const resolveScrollContainer = useCallback(() => {
    if (scrollContainerRef?.current) return scrollContainerRef.current;
    if (typeof document === 'undefined') return null;
    return document.scrollingElement as HTMLElement | null;
  }, [scrollContainerRef]);

  useLayoutEffect(() => {
    if (isAnimating) return;
    if (location.key === currentLayerKey) return;
    if (currentLayerPathname === location.pathname) return;
    const scrollContainer = resolveScrollContainer();
    const exitScrollOffset = scrollContainer?.scrollTop ?? 0;
    exitScrollOffsetRef.current = exitScrollOffset;
    scrollPositionsRef.current.set(currentLayerKey, exitScrollOffset);

    enterScrollOffsetRef.current = scrollPositionsRef.current.get(location.key) ?? 0;
    const resolveOrderIndex = (pathname?: string) => {
      if (!getRouteOrder || !pathname) return null;
      const index = getRouteOrder(pathname);
      return typeof index === 'number' && index >= 0 ? index : null;
    };
    const fromIndex = resolveOrderIndex(currentLayerPathname);
    const toIndex = resolveOrderIndex(location.pathname);
    const nextVariant: TransitionVariant = getTransitionVariant
      ? getTransitionVariant(currentLayerPathname ?? '', location.pathname)
      : 'vertical';

    let nextDirection: TransitionDirection =
      fromIndex === null || toIndex === null || fromIndex === toIndex
        ? 'forward'
        : toIndex > fromIndex
          ? 'forward'
          : 'backward';

    // When using iOS-style stacking, history POP within the same "section" can have equal route order.
    // In that case, prefer treating navigation to an existing layer as a backward (pop) transition.
    if (nextVariant === 'ios' && layers.some((layer) => layer.key === location.key)) {
      nextDirection = 'backward';
    }

    transitionDirectionRef.current = nextDirection;
    transitionVariantRef.current = nextVariant;

    const shouldSkipExitLayer = (() => {
      if (nextVariant !== 'ios' || nextDirection !== 'backward') return false;
      const normalizeSegments = (pathname: string) =>
        pathname
          .split('/')
          .filter(Boolean)
          .filter((segment) => segment.length > 0);
      const fromSegments = normalizeSegments(currentLayerPathname ?? '');
      const toSegments = normalizeSegments(location.pathname);
      if (!fromSegments.length || !toSegments.length) return false;
      return fromSegments[0] === toSegments[0] && toSegments.length === 1;
    })();

    setLayers((prev) => {
      const variant = transitionVariantRef.current;
      const direction = transitionDirectionRef.current;
      const previousCurrentIndex = prev.findIndex((layer) => layer.status === 'current');
      const resolvedCurrentIndex =
        previousCurrentIndex >= 0 ? previousCurrentIndex : prev.length - 1;
      const previousCurrent = prev[resolvedCurrentIndex];
      const previousStack: Layer[] = prev
        .filter((_, idx) => idx !== resolvedCurrentIndex)
        .map((layer): Layer => ({ ...layer, status: 'stacked' }));

      const nextCurrent: Layer = { key: location.key, location, status: 'current' };

      if (!previousCurrent) {
        nextLayersRef.current = [nextCurrent];
        return [nextCurrent];
      }

      if (variant === 'ios') {
        if (direction === 'forward') {
          const exitingLayer: Layer = { ...previousCurrent, status: 'exiting' };
          const stackedLayer: Layer = { ...previousCurrent, status: 'stacked' };

          nextLayersRef.current = [...previousStack, stackedLayer, nextCurrent];
          return [...previousStack, exitingLayer, nextCurrent];
        }

        const targetIndex = prev.findIndex((layer) => layer.key === location.key);
        if (targetIndex !== -1) {
          const targetStack: Layer[] = prev.slice(0, targetIndex + 1).map((layer, idx): Layer => {
            const isTarget = idx === targetIndex;
            return {
              ...layer,
              location: isTarget ? location : layer.location,
              status: isTarget ? 'current' : 'stacked',
            };
          });

          if (shouldSkipExitLayer) {
            nextLayersRef.current = targetStack;
            return targetStack;
          }

          const exitingLayer: Layer = { ...previousCurrent, status: 'exiting' };
          nextLayersRef.current = targetStack;
          return [...targetStack, exitingLayer];
        }
      }

      if (shouldSkipExitLayer) {
        nextLayersRef.current = [nextCurrent];
        return [nextCurrent];
      }

      const exitingLayer: Layer = { ...previousCurrent, status: 'exiting' };

      nextLayersRef.current = [nextCurrent];
      return [exitingLayer, nextCurrent];
    });
    setIsAnimating(true);
  }, [
    isAnimating,
    location,
    currentLayerKey,
    currentLayerPathname,
    getRouteOrder,
    getTransitionVariant,
    resolveScrollContainer,
    layers,
  ]);

  // Run Motion animation when animating starts
  useLayoutEffect(() => {
    if (!isAnimating) return;

    if (!currentLayerRef.current) return;

    const currentLayerEl = currentLayerRef.current;
    const exitingLayerEl = exitingLayerRef.current;
    clearLayerStyles(currentLayerEl);
    clearLayerStyles(exitingLayerEl);

    const scrollContainer = resolveScrollContainer();
    const exitScrollOffset = exitScrollOffsetRef.current;
    const enterScrollOffset = enterScrollOffsetRef.current;
    if (scrollContainer && exitScrollOffset !== enterScrollOffset) {
      scrollContainer.scrollTo({ top: enterScrollOffset, left: 0, behavior: 'auto' });
    }

    const exitBaseY = enterScrollOffset - exitScrollOffset;
    const activeAnimations: AnimationPlaybackControlsWithThen[] = [];
    let cancelled = false;
    let completed = false;
    const completeTransition = () => {
      if (completed) return;
      completed = true;

      const nextLayers = nextLayersRef.current;
      nextLayersRef.current = null;
      setLayers((prev) => nextLayers ?? prev.filter((layer) => layer.status !== 'exiting'));
      setIsAnimating(false);

      clearLayerStyles(currentLayerEl);
      clearLayerStyles(exitingLayerEl);
    };

    if (!prefersReducedMotion()) {
      if (exitingLayerEl) {
        // Pin the outgoing layer where it was on screen after the scroll container moved.
        if (exitBaseY !== 0) {
          exitingLayerEl.style.transform = `translate3d(0px, ${exitBaseY}px, 0px)`;
        }
        activeAnimations.push(
          animate(
            exitingLayerEl,
            { opacity: [1, 0] },
            { duration: CROSS_FADE_DURATION, ease: crossFadeEase }
          )
        );
      }

      currentLayerEl.style.opacity = '0';
      activeAnimations.push(
        animate(
          currentLayerEl,
          { opacity: [0, 1] },
          { duration: CROSS_FADE_DURATION, ease: crossFadeEase }
        )
      );
    }

    if (!activeAnimations.length) {
      completeTransition();
    } else {
      void Promise.all(
        activeAnimations.map((animation) => animation.finished.catch(() => undefined))
      ).then(() => {
        if (cancelled) return;
        completeTransition();
      });
    }

    return () => {
      cancelled = true;
      activeAnimations.forEach((animation) => animation.stop());
    };
  }, [isAnimating, resolveScrollContainer]);

  return (
    <div className={`page-transition${isAnimating ? ' page-transition--animating' : ''}`}>
      {(() => {
        const currentIndex = layers.findIndex((layer) => layer.status === 'current');
        const resolvedCurrentIndex = currentIndex === -1 ? layers.length - 1 : currentIndex;
        const keepStackedIndex = layers
          .slice(0, resolvedCurrentIndex)
          .map((layer, index) => ({ layer, index }))
          .reverse()
          .find(({ layer }) => layer.status === 'stacked')?.index;

        return layers.map((layer, index) => {
          const shouldKeepStacked = layer.status === 'stacked' && index === keepStackedIndex;
          return (
            <div
              key={layer.key}
              className={[
                'page-transition__layer',
                layer.status === 'exiting' ? 'page-transition__layer--exit' : '',
                layer.status === 'stacked' ? 'page-transition__layer--stacked' : '',
                shouldKeepStacked ? 'page-transition__layer--stacked-keep' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-hidden={layer.status !== 'current'}
              inert={layer.status !== 'current'}
              ref={
                layer.status === 'exiting'
                  ? exitingLayerRef
                  : layer.status === 'current'
                    ? currentLayerRef
                    : undefined
              }
            >
              <PageTransitionLayerContext.Provider
                value={{
                  ...PAGE_TRANSITION_LAYER_CONTEXT_VALUES[layer.status],
                  isAnimating,
                }}
              >
                {render(layer.location)}
              </PageTransitionLayerContext.Provider>
            </div>
          );
        });
      })()}
    </div>
  );
}
