import { Component, OnInit } from '@angular/core';
import { IGalleryItem } from '../../interfaces/gallery-items.interface';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { MatRipple } from '@angular/material/core';
import { GalleryItemViewerComponent } from './gallery-item-viewer/gallery-item-viewer.component';
import { catchError, forkJoin, map, Observable, of, startWith } from 'rxjs';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

@Component({
    selector: 'app-gallery',
    templateUrl: './gallery.component.html',
    styleUrls: ['./gallery.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        NgOptimizedImage,
        MatRipple,
        FormsModule,
        MatProgressSpinner,
    ],
})
export class GalleryComponent implements OnInit {
    protected readonly title = 'Gallery';

    /**
     * Array containing image sources for collage
     */
    protected imageSources$?: Observable<IGalleryItem[]>;

    /**
     * Loading state observable
     */
    protected isLoading$?: Observable<boolean>;

    /**
     * Array of image URLs
     */
    private readonly _imageUrls: string[] = [];

    constructor(private readonly _bottomSheetRef: MatBottomSheet) {}

    ngOnInit() {
        for (let i = 1; i < 41; i++) {
            this._imageUrls.push('/images/IMG_' + i + '.webp');
        }

        // Set up image loading
        this.imageSources$ = forkJoin(
            this._imageUrls.map(
                (url: string): Observable<IGalleryItem> =>
                    this._getImageMetadata(url),
            ),
        ).pipe(catchError(() => of([])));

        // Show loader until images are done loading
        this.isLoading$ = this.imageSources$.pipe(
            map(() => false),
            startWith(true),
            catchError(() => of(false)),
        );
    }

    /**
     * Obtains image meta-data based on image source
     * @param source The image source URL
     */
    private _getImageMetadata(source: string): Observable<IGalleryItem> {
        return new Observable(observer => {
            const img = new Image();
            const localCache = localStorage.getItem(source);

            const cleanup = () => {
                img.onload = null;
                img.onerror = null;
            };

            img.onload = () => {
                let galleryItem: IGalleryItem;

                if (localCache) {
                    galleryItem = JSON.parse(localCache) as IGalleryItem;
                } else {
                    galleryItem = {
                        alt: 'Photo memory of Alexander and Shala',
                        source,
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                    };
                    this._setImageDescriptions(galleryItem);
                    localStorage.setItem(source, JSON.stringify(galleryItem));
                }

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

    /**
     * Sets the image description based on passed in image
     * @param image The image object
     */
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
     * Opens a sheet to display the specified gallery item
     * @param item The gallery item to display in the sheet
     */
    openItemSheet(item: IGalleryItem): void {
        this._bottomSheetRef.open(GalleryItemViewerComponent, {
            data: { item },
            panelClass: 'sheet',
        });
    }
}
