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
    OnInit,
} from '@angular/core';
import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { IGalleryItem } from '../../interfaces/gallery-items.interface';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { MatRipple } from '@angular/material/core';
import { GalleryItemViewerComponent } from './gallery-item-viewer/gallery-item-viewer.component';
import {
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
} from '@angular/material/card';
import { catchError, forkJoin, Observable, of} from 'rxjs';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import {
    MatButtonToggle,
    MatButtonToggleGroup,
} from '@angular/material/button-toggle';
import { FormsModule } from '@angular/forms';

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
        MatButtonToggleGroup,
        MatButtonToggleGroup,
        MatButtonToggle,
        FormsModule,
    ],
})
export class GalleryComponent
    implements AfterViewInit, OnInit, OnDestroy, OnChanges
{
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
     * Array containing image sources for collage
     */
    protected imageSources$?: Observable<IGalleryItem[]>;

    /**
     * The index of the currently active/hero item in the gallery
     * Used to track the current state and apply appropriate styling
     */
    protected currentIndex = 0;

    /**
     * Array of image URLs
     */
    private readonly _imageUrls: string[] = [];

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

    constructor(private readonly _bottomSheetRef: MatBottomSheet) {}

    ngOnInit() {
        for (let i = 1; i < 41; i++) {
            this._imageUrls.push('/images/IMG_' + i + '.webp');
        }

        this.imageSources$ = forkJoin(
            this._imageUrls.map(
                (url: string): Observable<IGalleryItem> =>
                    this._getImageMetadata(url),
            ),
        ).pipe(catchError(() => of([])));
    }

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
     * Toggles the gallery's view mode
     */
    /**
     * Toggles the gallery's view mode
     */
    toggleGalleryMode(): void {
        const isCurrentlyGallery = this.viewMode === 'gallery';

        // Toggle the view mode
        this.viewMode = isCurrentlyGallery ? 'carousel' : 'gallery';

        // Handle side effects based on transition
        if (isCurrentlyGallery) {
            // Switched from gallery to carousel
            setTimeout(() => this._initCarouselIfNeeded(), 0);
        } else {
            // Switched from carousel to gallery
            this._cleanUpCarousel();
        }

        this._previousViewMode = this.viewMode;
    }
    /**
     * Obtains image meta-data based on image source
     * @param source The image source URL
     */
    private _getImageMetadata(source: string): Observable<IGalleryItem> {
        return new Observable(observer => {
            const img = new Image();
            const localCache = localStorage.getItem(source);
            if (localCache) {
                const galleryItem = JSON.parse(localCache) as IGalleryItem;
                observer.next(galleryItem);
                observer.complete();
                return;
            }

            const cleanup = () => {
                img.onload = null;
                img.onerror = null;
            };

            img.onload = () => {
                const galleryItem: IGalleryItem = {
                    alt: 'Photo memory of Alexander and Shala',
                    source,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                };
                this._setImageDescriptions(galleryItem);
                localStorage.setItem(source, JSON.stringify(galleryItem));
                observer.next(galleryItem);
                observer.complete();
                cleanup();
            };

            img.onerror = () => {
                observer.error(`Failed to load image: ${source}`);
                cleanup();
            };

            img.src = source;
        });
    }

    private _setImageDescriptions(image: IGalleryItem): void {
        const key = image.source.replace('/images/', '');
        switch (key) {
            case 'IMG_1.webp':
                image.date = 'May 2021';
                image.description =
                    'Our first date — a day filled with nerves and excitement. I still remember seeing him for the first' +
                    'time in the parking garage, standing there with a purple plushie in his hand, waiting just for me.';
                break;
            case 'IMG_2.webp':
                image.date = 'July 2021';
                image.description =
                    'Our first theme park adventure — filled with laughter, fun, and the discovery of our shared love ' +
                    'for food.';
                break;
            case 'IMG_3.webp':
                image.date = 'November 2021';
                image.description =
                    'A nighttime mini golf date — just us, some friendly competition, and the leftover light of a setting sun.';
                break;
            case 'IMG_4.webp':
                image.date = 'December 2021';
                image.description =
                    'Our day at Busch Gardens started the only way it could — with a Starbucks stop as soon as we walked through the gates.';
                break;
            case 'IMG_5.webp':
                image.date = 'December 2021';
                image.description =
                    'As day turned to night, the park lit up with a magical glow — and so began the onslaught of photos.';
                break;
            case 'IMG_6.webp':
                image.date = 'December 2021';
                image.description =
                    'Exhibit A from that photo frenzy — proof that once the lights came on, so did the camera!';
                break;
            case 'IMG_7.webp':
                image.date = 'December 2021';
                image.description =
                    'We even paused for a photo beneath this beautifully lit pathway of lights.';
                break;
            case 'IMG_8.webp':
                image.date = 'December 2021';
                image.description =
                    'We spent a memorable day at SeaWorld, soaking in the fun just before the year came to a close.';
                break;
            case 'IMG_9.webp':
                image.date = 'December 2021';
                image.description =
                    'Waiting in anticipation for one of the Seaworld shows to begin.';
                break;
            case 'IMG_10.webp':
                image.date = 'December 2021';
                image.description =
                    'We explored one of the Villages, shared countless laughs, and ended the day with a relaxing boat ride.';
                break;
            case 'IMG_11.webp':
                image.date = 'January 2022';
                image.description =
                    'Celebrating the start of a new year together, full of promise and new memories';
                break;
            case 'IMG_12.webp':
                image.date = 'February 2022';
                image.description =
                    'Celebrating my 22nd birthday at Disney’s Magic Kingdom — a magical day to remember.';
                break;
            case 'IMG_13.webp':
                image.date = 'April 2022';
                image.description =
                    'Relaxing on a swing outside Alex’s job while he was on break — one of many lunch breaks we shared,' +
                    'filled with laughter and plenty of silly photos.';
                break;
            case 'IMG_14.webp':
                image.date = 'June 2022';
                image.description =
                    'For our first anniversary, we explored Disney’s Animal Kingdom with Alex’s family, who were in town.';
                break;
            case 'IMG_15.webp':
                image.date = 'June 2022';
                image.description =
                    'When Alex’s cousin was in town, we didn’t waste any time — we took him straight to an escape room!';
                break;
            case 'IMG_16.webp':
                image.date = 'October 2022';
                image.description =
                    'During a much-needed break from work, we spent a weekend in a cozy log cabin, enjoying the nearby' +
                    'springs and the peaceful getaway.';
                break;
            case 'IMG_17.webp':
                image.date = 'January 2023';
                image.description =
                    'At the height of our escape room obsession, we tackled one with Alex’s sister and friend — and ' +
                    'after requesting “five more minutes,” we finally cracked the code and solved the room!';
                break;
            case 'IMG_18.webp':
                image.date = 'February 2023';
                image.description =
                    'For my 23rd birthday, Alex and his mom surprised me with a delicious chocolate cake — a perfect ' +
                    'treat to celebrate the day.';
                break;
            case 'IMG_19.webp':
                image.date = 'May 2023';
                image.description =
                    'Cooling off at Magic Kingdom with a sweet ice cream — the perfect way to beat the heat.';
                break;
            case 'IMG_20.webp':
                image.date = 'May 2023';
                image.description =
                    'After a full day of exploring Magic Kingdom, Alex surprised me with reservations at an amazing' +
                    'Italian restaurant right in the park — the perfect end to a magical day.';
                break;
            case 'IMG_21.webp':
                image.date = 'June 2023';
                image.description =
                    'For our 2nd anniversary, we recreated our first date by revisiting the Eye of Orlando — a beautiful' +
                    ' way to relive that special moment.';
                break;
            case 'IMG_22.webp':
                image.date = 'November 2023';
                image.description =
                    'On a random Sunday, we visited the Kennedy Space Center and, by sheer luck, ended up there on the ' +
                    'day of a launch. We spent about an hour scrambling to figure out how to buy tickets for the event' +
                    'while at the park — definitely a day to remember!';
                break;
            case 'IMG_23.webp':
                image.date = 'December 2023';
                image.description =
                    'This picture holds a special story: For months, I had been begging Alex to wear a suit — or at ' +
                    'least let me see him try one on. For my graduation, Alex brought a suit just for the occasion. ' +
                    'I was absolutely over the moon.';
                break;
            case 'IMG_24.webp':
                image.date = 'February 2024';
                image.description =
                    'For my 24th birthday, Alex surprised me with a weekend getaway to Disney’s Coronado Springs — the ' +
                    'perfect way to celebrate.';
                break;
            case 'IMG_25.webp':
                image.date = 'February 2024';
                image.description =
                    'During our stay, we made it our mission to enjoy the pool. Alex had a blast on the slide, and we ' +
                    'spent hours foot racing through the water.';
                break;
            case 'IMG_26.webp':
                image.date = 'February 2024';
                image.description =
                    'Additional for my 24th birthday, we spent hours playing in the pool — making memories and enjoying' +
                    'every moment.';
                break;
            case 'IMG_27.webp':
                image.date = 'March 2024';
                image.description =
                    'At the Orlando Zoo, we took our time exploring the serene botanical garden section — a peaceful' +
                    'escape surrounded by nature.';
                break;
            case 'IMG_28.webp':
                image.date = 'April 2024';
                image.description =
                    'While exploring Disney Springs, we stumbled upon a photo op for one of our favorite shows — a ' +
                    'perfect chance to capture the moment.';
                break;
            case 'IMG_29.webp':
                image.date = 'June 2024';
                image.description =
                    'For our 3rd anniversary, we spent a rainy day at Disney’s Magic Kingdom. Though the day ended with' +
                    'both of us getting sick for different reasons, it’s a memory we laugh about all the time.';
                break;
            case 'IMG_30.webp':
                image.date = 'October 2024';
                image.description =
                    'For Alex’s 29th birthday, we spent the day at Disney’s Hollywood Studios — celebrating in true' +
                    'Disney fashion.';
                break;
            case 'IMG_31.webp':
                image.date = 'October 2024';
                image.description =
                    'As always, we kicked off Alex’s birthday Disney trip with a quick stop for Starbucks inside the' +
                    'park — the perfect way to start the day.';
                break;
            case 'IMG_32.webp':
                image.date = 'November 2024';
                image.description =
                    'Just outside my sister’s wedding reception, we took a few pictures with my family — capturing the' +
                    'joy of the day.';
                break;
            case 'IMG_33.webp':
                image.date = 'February 2025';
                image.description =
                    'After dinner on Valentine’s Day, we strolled through the night market, enjoying the sights and' +
                    'each other’s company.';
                break;
            case 'IMG_34.webp':
                image.date = 'February 2025';
                image.description =
                    'A few hours before the proposal, we relaxed and took a few photos at our first date spot — a place' +
                    'filled with memories.';
                break;
            case 'IMG_35.webp':
                image.date = 'February 2025';
                image.description =
                    'A few hours before the proposal, we relaxed and took a few photos at our first date spot — a place' +
                    'filled with memories.';
                break;
            case 'IMG_36.webp':
                image.date = 'February 2025';
                image.description =
                    'Just a few minutes later, when we reached the top of the wheel, Alex popped the question — a moment' +
                    ' I’ll never forget.';
                break;
            case 'IMG_37.webp':
                image.date = 'February 2025';
                image.description =
                    'On the day of our engagement, I was surprised to find our house beautifully decorated to celebrate' +
                    ' this special moment.';
                break;
            case 'IMG_38.webp':
                image.date = 'March 2025';
                image.description =
                    'We attended our first comedy show to see YouTuber Goose Wayne — a night filled with laughter and' +
                    'great memories.';
                break;
            case 'IMG_39.webp':
                image.date = 'April 2025';
                image.description =
                    'Nico received his first pup cup — and he inhaled it in record time!';
                break;
            case 'IMG_40.webp':
                image.date = 'April 2025';
                image.description =
                    'A simple day at home, just the three of us cuddling together on the couch — pure comfort and happiness.';
                break;
            default:
                break;
        }
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
        this._bottomSheetRef.open(GalleryItemViewerComponent, {
            data: { item },
            panelClass: 'sheet',
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
            dragResistance: 0.5,
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
            duration: 0.2,
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
