import { Component, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { catchError, forkJoin, Observable, of } from 'rxjs';
import { MatButton, MatFabButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { IGalleryItem } from '../../interfaces/gallery-items.interface';
import { GalleryComponent } from './gallery/gallery.component';

@Component({
    selector: 'app-our-story',
    templateUrl: './our-story.component.html',
    styleUrl: './our-story.component.scss',
    imports: [
        AsyncPipe,
        MatIcon,
        MatFabButton,
        MatButton,
        MatSlideToggle,
        GalleryComponent,
    ],
})
export class OurStoryComponent implements OnInit {
    /**
     * View title
     */
    protected title = 'Our Story';

    /**
     * Array containing image sources for collage
     */
    protected imageSources$?: Observable<IGalleryItem[]>;

    /**
     * Denotes whether to show the collage
     */
    protected showGallery = false;

    /**
     * Denotes whether to show the collage
     */
    protected galleryViewMode: 'gallery' | 'carousel' = 'gallery';

    /**
     * Array of image URLs
     */
    private readonly _imageUrls: string[] = [];

    ngOnInit() {
        for (let i = 1; i < 34; i++) {
            this._imageUrls.push('/images/IMG_' + i + '.webp');
        }

        this.imageSources$ = forkJoin(
            this._imageUrls.map(
                (url: string): Observable<IGalleryItem> =>
                    this._getImageMetadata(url),
            ),
        ).pipe(catchError(() => of([])));
    }

    /**
     * Toggles collage view
     */
    toggleCollage(): void {
        this.showGallery = !this.showGallery;
    }

    /**
     * Toggles the gallery's view mode
     */
    toggleGalleryMode(): void {
        if (this.galleryViewMode === 'gallery') {
            this.galleryViewMode = 'carousel';
        } else if (this.galleryViewMode === 'carousel') {
            this.galleryViewMode = 'gallery';
        }
    }

    /**
     * Obtains image meta-data based on image source
     * @param source The image source URL
     */
    private _getImageMetadata(source: string): Observable<IGalleryItem> {
        return new Observable(observer => {
            const img = new Image();

            img.onload = () => {
                const width = img.naturalWidth;
                const height = img.naturalHeight;

                observer.next({
                    alt: 'Photo memory of Alexander and Shala',
                    source,
                    width,
                    height,
                } as IGalleryItem);
                observer.complete();
            };

            img.onerror = () => {
                observer.error(`Failed to load image: ${source}`);
            };

            img.src = source;
        });
    }
}
