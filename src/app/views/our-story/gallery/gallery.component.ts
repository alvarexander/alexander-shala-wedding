import {
    Component,
    AfterViewInit,
    ViewChild,
    ElementRef,
    Input,
    OnDestroy,
    HostListener,
    OnChanges,
    SimpleChanges,
} from '@angular/core';
import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { IGalleryItem } from '../../../interfaces/gallery-items.interface';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { MatRipple } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { GalleryItemDialogComponent } from './gallery-item-view-dialog/gallery-item-dialog.component';
import {
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
} from '@angular/material/card';

/**
 * Material Design 3 styled image carousel component
 * Features responsive behavior, a hero card with adjacent and non-hero cards
 * in a draggable interface with proper snapping and transitions.
 */
@Component({
    selector: 'app-gallery',
    templateUrl: './gallery.component.html',
    styleUrls: ['./gallery.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        NgOptimizedImage,
        MatRipple,
        MatCard,
        MatCardTitle,
        MatCardHeader,
        MatCardContent,
    ],
})
export class GalleryComponent implements AfterViewInit, OnDestroy, OnChanges {
    /**
     * The items to be included in the gallery carousel
     * Each gallery item should conform to the IGalleryItem interface
     * with a source property (URL of the image) and alt text
     */
    @Input() galleryItems: IGalleryItem[] = [];

    /**
     * Denotes the gallery's view mode
     */
    @Input() viewMode?: 'gallery' | 'carousel' = 'gallery';

    /**
     * Reference to the carousel element that contains all gallery items
     * Used to apply dragging behavior and transformations
     */
    @ViewChild('carousel') carouselRef!: ElementRef<HTMLDivElement>;

    /**
     * Reference to the parent container of the carousel
     * Used for calculating bounds and responsive adjustments
     */
    @ViewChild('carouselContainer') containerRef!: ElementRef<HTMLDivElement>;

    /**
     * The index of the currently active/hero item in the gallery
     * Used to track the current state and apply appropriate styling
     */
    protected currentIndex = 0;

    /**
     * GSAP Draggable instance that handles the dragging behavior
     * Includes inertia, snap points, and bounds
     */
    private _draggableInstance: Draggable | null = null;

    /**
     * Resize observer used for responsive adjustments to carousel
     * Detects size changes and triggers appropriate recalculations
     */
    private _resizeObserver: ResizeObserver | null = null;

    /**
     * Array of horizontal snap points for gallery items
     * Each point represents the x-coordinate where a card should snap to become the hero
     */
    private _snapPoints: number[] = [];

    /**
     * Indicates whether the current viewport size is considered mobile
     * Triggers different styling and behavior based on screen width
     */
    private _isMobile = false;

    /**
     * Tracks the previous view mode to detect changes
     */
    private _previousViewMode?: 'gallery' | 'carousel';

    constructor(private readonly _dialogRef: MatDialog) {}

    /**
     * Initializes the carousel after the view has been initialized
     * Sets up GSAP, initializes the carousel, and starts observing for resize events
     */
    ngAfterViewInit(): void {
        gsap.registerPlugin(Draggable);

        // Wait for DOM to be ready
        setTimeout(() => {
            // Only initialize carousel if in carousel mode
            if (this.viewMode === 'carousel') {
                this._initCarouselIfNeeded();
            }

            this._previousViewMode = this.viewMode;
        }, 0);
    }

    /**
     * Handles changes to component inputs
     * Especially important for view mode changes
     */
    ngOnChanges(changes: SimpleChanges): void {
        // Check if viewMode changed
        if (changes['viewMode'] && !changes['viewMode'].firstChange) {
            const currentMode = changes['viewMode'].currentValue;
            const previousMode = changes['viewMode'].previousValue;

            // Clean up carousel if switching from carousel to gallery
            if (previousMode === 'carousel' && currentMode === 'gallery') {
                this._cleanUpCarousel();
            }
            // Initialize carousel if switching from gallery to carousel
            else if (previousMode === 'gallery' && currentMode === 'carousel') {
                // Use setTimeout to ensure DOM is updated after view mode change
                setTimeout(() => {
                    this._initCarouselIfNeeded();
                }, 0);
            }

            this._previousViewMode = currentMode;
        }
    }

    /**
     * Cleans up resources when the component is destroyed
     * Removes GSAP draggable instance and disconnects resize observer
     */
    ngOnDestroy(): void {
        this._cleanUpCarousel();
    }

    /**
     * Handles window resize events to ensure carousel responsiveness
     * Updates bounds and image scales when the window size changes
     */
    @HostListener('window:resize')
    onResize(): void {
        // Only process resize if in carousel mode
        if (this.viewMode === 'carousel' && this._draggableInstance) {
            this._checkScreenSize();
            this._updateBounds();
            this.updateImageScales();
        }
    }

    /**
     * Opens a modal dialog to display the specified gallery item
     * @param item The gallery item to display in the modal
     */
    openItemModal(item: IGalleryItem): void {
        this._dialogRef.open(GalleryItemDialogComponent, {
            width: '95%',
            maxWidth: '650px',
            maxHeight: '90vh',
            panelClass: 'gallery-dialog-container',
            data: { item },
        });
    }

    /**
     * Updates image scales and applies appropriate styling based on carousel position
     * Determines which card should be the hero and which should be adjacent
     * Ensures that there's always a hero card visible during scrolling
     *
     * This is public to allow external components to trigger updates when needed
     */
    updateImageScales(): void {
        // Only proceed if in carousel mode and references exist
        if (
            this.viewMode !== 'carousel' ||
            !this.carouselRef ||
            !this.containerRef
        ) {
            return;
        }

        const carousel = this.carouselRef.nativeElement;
        const container = this.containerRef.nativeElement;
        const containerCenter = container.clientWidth / 2;

        const wrappers = Array.from(
            carousel.querySelectorAll('.gallery__image-wrapper'),
        ) as HTMLElement[];

        // First, remove all special classes
        wrappers.forEach(wrapper => {
            wrapper.classList.remove('active', 'adjacent');
        });

        // Find the card closest to center to make it the hero
        let minDistance = Infinity;
        let heroIndex = -1;

        wrappers.forEach((wrapper, index) => {
            const rect = wrapper.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const wrapperCenter =
                rect.left + rect.width / 2 - containerRect.left;

            const distanceFromCenter = Math.abs(
                containerCenter - wrapperCenter,
            );

            // Find the card closest to center
            if (distanceFromCenter < minDistance) {
                minDistance = distanceFromCenter;
                heroIndex = index;
            }
        });

        // Always make a card active - prevents the "all small cards" issue
        if (heroIndex >= 0) {
            wrappers[heroIndex].classList.add('active');
            this.currentIndex = heroIndex;

            // Add adjacent class to cards immediately next to the hero (both sides)
            if (heroIndex > 0) {
                wrappers[heroIndex - 1].classList.add('adjacent');
            }

            if (heroIndex < wrappers.length - 1) {
                wrappers[heroIndex + 1].classList.add('adjacent');
            }
        } else if (wrappers.length > 0) {
            // Fallback if no card was found close enough to center
            // Find the card that's most visible in the container
            let mostVisibleIndex = 0;
            let maxVisibleWidth = 0;

            wrappers.forEach((wrapper, index) => {
                const rect = wrapper.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();

                // Calculate how much of the card is visible in the container
                const leftVisible = Math.max(rect.left, containerRect.left);
                const rightVisible = Math.min(rect.right, containerRect.right);
                const visibleWidth = Math.max(0, rightVisible - leftVisible);

                if (visibleWidth > maxVisibleWidth) {
                    maxVisibleWidth = visibleWidth;
                    mostVisibleIndex = index;
                }
            });

            // Make the most visible card active
            wrappers[mostVisibleIndex].classList.add('active');
            this.currentIndex = mostVisibleIndex;

            // Add adjacent class to cards next to the most visible
            if (mostVisibleIndex > 0) {
                wrappers[mostVisibleIndex - 1].classList.add('adjacent');
            }

            if (mostVisibleIndex < wrappers.length - 1) {
                wrappers[mostVisibleIndex + 1].classList.add('adjacent');
            }
        }
    }

    /**
     * Helper method to initialize carousel only when needed and when references exist
     * @private
     */
    private _initCarouselIfNeeded(): void {
        if (this.viewMode !== 'carousel') {
            return;
        }

        // Set up resize observer only when initializing carousel
        if (!this._resizeObserver && this.containerRef) {
            this._resizeObserver = new ResizeObserver(() => {
                if (this.viewMode !== 'carousel') return;

                const wasMobile = this._isMobile;
                this._checkScreenSize();

                // Only reinitialize if changing between mobile/desktop modes
                // or if draggable instance doesn't exist
                if (wasMobile !== this._isMobile || !this._draggableInstance) {
                    if (this._draggableInstance) {
                        this._draggableInstance.kill();
                    }
                    this._initCarousel();
                } else {
                    this._updateBounds();
                    this.updateImageScales();
                }
            });

            this._resizeObserver.observe(this.containerRef.nativeElement);
        }

        this._checkScreenSize();
        this._initCarousel();
    }

    /**
     * Cleans up carousel resources
     */
    private _cleanUpCarousel(): void {
        if (this._draggableInstance) {
            this._draggableInstance.kill();
            this._draggableInstance = null;
        }

        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
    }

    /**
     * Initializes the carousel with Material Design 3 styling and behavior
     * Sets up card dimensions, snap points, dragging bounds, and event handlers
     * Handles different device orientations and screen sizes
     */
    private _initCarousel(): void {
        if (!this.carouselRef || !this.containerRef) {
            return;
        }
        const carousel = this.carouselRef.nativeElement;
        const container = this.containerRef.nativeElement;
        const wrappers = Array.from(
            carousel.querySelectorAll('.gallery__image-wrapper'),
        ) as HTMLElement[];

        if (!wrappers.length) {
            return;
        }

        // Check if in landscape mode with low height
        const isLandscapeCompact =
            window.innerHeight <= 500 && window.innerWidth > window.innerHeight;

        // Calculate card dimensions and spacing
        const cardDimensions =
            this._calculateCardDimensions(isLandscapeCompact);

        // Apply specific mobile styles
        if (this._isMobile) {
            carousel.classList.add('mobile-view');
        } else {
            carousel.classList.remove('mobile-view');
        }

        // Calculate bounds, snap points, and create draggable
        const bounds = this._calculateCarouselBounds(
            wrappers,
            cardDimensions,
            container.clientWidth,
        );

        // Create draggable with bounds for all orientations
        this._draggableInstance = Draggable.create(carousel, {
            type: 'x',
            inertia: true,
            edgeResistance: 0.7,
            dragResistance: 0.3,
            throwResistance: 0.7,
            bounds: bounds.draggableBounds,
            snap: {
                x: value => this._findNearestSnapPoint(value),
            },
            onDrag: () => {
                window.requestAnimationFrame(() => this.updateImageScales());
            },
            onThrowUpdate: () => {
                window.requestAnimationFrame(() => this.updateImageScales());
            },
            onThrowComplete: () => this._updateCurrentIndex(),
        })[0];

        // Set initial position
        gsap.set(carousel, {
            x: this._snapPoints[0],
            clearProps: 'none',
        });

        // Initial setup
        this.updateImageScales();
    }

    /**
     * Detects screen size and orientation changes
     * Updates internal state and triggers re-initialization when needed
     * Handles transitions between mobile/desktop views and landscape/portrait orientations
     */
    private _checkScreenSize(): void {
        this._isMobile = window.innerWidth <= 768;

        // When orientation changes, we need to re-init the carousel
        // This will be used to detect landscape/portrait modes
        const isLandscape = window.innerWidth > window.innerHeight;
        const isLandscapeCompact = window.innerHeight <= 500 && isLandscape;

        // Store orientation state to detect changes
        if (!this.hasOwnProperty('_prevOrientation')) {
            (this as any)._prevOrientation = isLandscape;
            (this as any)._prevIsCompact = isLandscapeCompact;
        }

        // If orientation changed, force a complete re-init
        if (
            (this as any)._prevOrientation !== isLandscape ||
            (this as any)._prevIsCompact !== isLandscapeCompact
        ) {
            // Update stored orientation
            (this as any)._prevOrientation = isLandscape;
            (this as any)._prevIsCompact = isLandscapeCompact;

            // If draggable instance exists, kill it so we can rebuild
            if (this._draggableInstance) {
                this._draggableInstance.kill();
                this._draggableInstance = null;
            }
        }
    }

    /**
     * Determines the closest snap point to the current carousel position
     * Used by the GSAP Draggable for creating the snapping effect
     * Ensures cards properly align when dragging stops
     *
     * @param value The current x position of the carousel
     * @returns The x position of the nearest snap point
     */
    private _findNearestSnapPoint(value: number): number {
        // Find the closest snap point to current position
        let closest = this._snapPoints[0];
        let closestDistance = Math.abs(value - this._snapPoints[0]);

        for (let i = 1; i < this._snapPoints.length; i++) {
            const distance = Math.abs(value - this._snapPoints[i]);
            if (distance < closestDistance) {
                closest = this._snapPoints[i];
                closestDistance = distance;
            }
        }

        return closest;
    }

    /**
     * Updates carousel bounds in response to container size changes
     * Recalculates snap points, dragging limits, and card dimensions
     * Ensures all cards can become the hero, including the first and last ones
     */
    private _updateBounds(): void {
        if (!this._draggableInstance || this.viewMode !== 'carousel') {
            return;
        }

        if (!this.carouselRef || !this.containerRef) {
            return;
        }

        const carousel = this.carouselRef.nativeElement;
        const container = this.containerRef.nativeElement;
        const wrappers = Array.from(
            carousel.querySelectorAll('.gallery__image-wrapper'),
        ) as HTMLElement[];

        if (!wrappers.length) {
            return;
        }

        // Calculate card dimensions and spacing for current device
        const cardDimensions = this._calculateCardDimensions();

        // Calculate bounds and snap points
        const bounds = this._calculateCarouselBounds(
            wrappers,
            cardDimensions,
            container.clientWidth,
        );

        // Update bounds to ensure all cards can center, including first and last
        this._draggableInstance.applyBounds(bounds.draggableBounds);

        // Ensure current index is valid
        if (this.currentIndex >= wrappers.length) {
            this.currentIndex = 0;
        }

        // Snap to current index with smoother animation
        gsap.to(carousel, {
            x: this._snapPoints[this.currentIndex] || bounds.initialOffset,
            duration: 0.3,
            ease: 'power2.out',
            onComplete: () => this.updateImageScales(),
        });
    }

    /**
     * Updates the current index based on carousel position
     * Used after throw/drag operations to determine which card is now the hero
     * Finds the closest snap point to the current position
     */
    private _updateCurrentIndex(): void {
        if (!this.carouselRef) return;

        const carouselX = gsap.getProperty(
            this.carouselRef.nativeElement,
            'x',
        ) as number;

        // Find current index based on position
        let minDistance = Infinity;
        let index = 0;

        this._snapPoints.forEach((point, i) => {
            const distance = Math.abs(carouselX - point);
            if (distance < minDistance) {
                minDistance = distance;
                index = i;
            }
        });

        this.currentIndex = index;
    }

    /**
     * Calculates card dimensions based on screen size and orientation
     * Used for consistent sizing across different methods
     *
     * @param isLandscapeCompact Whether the device is in compact landscape mode
     * @returns Object containing all card dimension values
     */
    private _calculateCardDimensions(isLandscapeCompact?: boolean): {
        heroCardWidth: number;
        adjacentCardWidth: number;
        nonHeroCardWidth: number;
        itemGap: number;
    } {
        // Check landscape compact if not provided
        if (isLandscapeCompact === undefined) {
            isLandscapeCompact =
                window.innerHeight <= 500 &&
                window.innerWidth > window.innerHeight;
        }

        // Calculate dimensions - different for mobile vs desktop with landscape awareness
        const heroCardWidth = this._isMobile
            ? isLandscapeCompact
                ? 180
                : 200
            : isLandscapeCompact
              ? 280
              : 340;

        const adjacentCardWidth = this._isMobile
            ? isLandscapeCompact
                ? 80
                : 100
            : isLandscapeCompact
              ? 110
              : 140;

        const nonHeroCardWidth = this._isMobile
            ? isLandscapeCompact
                ? 55
                : 65
            : isLandscapeCompact
              ? 70
              : 90;

        const itemGap = this._isMobile ? 8 : isLandscapeCompact ? 10 : 14;

        return {
            heroCardWidth,
            adjacentCardWidth,
            nonHeroCardWidth,
            itemGap,
        };
    }

    /**
     * Calculates bounds and snap points for the carousel
     * Used to determine draggable limits and card positioning
     *
     * @param wrappers Array of card wrapper elements
     * @param dimensions Card dimension values
     * @param containerWidth Width of the container element
     * @returns Object with bounds, snap points, and offset values
     */
    private _calculateCarouselBounds(
        wrappers: HTMLElement[],
        dimensions: ReturnType<typeof this._calculateCardDimensions>,
        containerWidth: number,
    ): {
        initialOffset: number;
        draggableBounds: { minX: number; maxX: number };
    } {
        const { heroCardWidth, adjacentCardWidth, nonHeroCardWidth, itemGap } =
            dimensions;

        // For MD3 style, position with padding to center the hero card
        const initialOffset = (containerWidth - heroCardWidth) / 2;

        // Calculate bounds for full scrolling ability
        const leftPadding = 40; // Extra left padding
        const rightPadding = containerWidth - heroCardWidth + 40; // Extra right padding

        // Calculate total content width with precision
        const totalContentWidth =
            wrappers.length > 0
                ? heroCardWidth + // First card as hero
                  2 * adjacentCardWidth + // Two adjacent cards (left and right of first/last hero)
                  (wrappers.length - 3) * nonHeroCardWidth + // Remaining as non-hero cards
                  (wrappers.length - 1) * itemGap
                : 0; // Gaps between cards

        // Calculate maximum drag amount with proper padding
        const maxDrag = totalContentWidth + rightPadding - containerWidth;

        // Calculate snap points
        this._snapPoints = wrappers.map((_, i) => {
            let leftCardsWidth = 0;

            // Calculate width of all cards to the left of hero
            for (let j = 0; j < i; j++) {
                if (i - j === 1) {
                    // Card adjacent to hero
                    leftCardsWidth += adjacentCardWidth;
                } else {
                    // Regular non-hero card
                    leftCardsWidth += nonHeroCardWidth;
                }
                // Add gap
                leftCardsWidth += itemGap;
            }

            return initialOffset - leftCardsWidth;
        });

        return {
            initialOffset,
            draggableBounds: {
                minX: initialOffset - maxDrag - leftPadding,
                maxX: initialOffset + leftPadding,
            },
        };
    }
}
