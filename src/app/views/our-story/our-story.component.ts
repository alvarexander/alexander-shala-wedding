import { Component, OnInit } from '@angular/core';
import { AsyncPipe, NgOptimizedImage } from '@angular/common';
import { catchError, forkJoin, Observable, of } from 'rxjs';
import { MatButton, MatFabButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { ContentScrollService } from '../../components/services/content-scroll.service';

@Component({
    selector: 'app-our-story',
    templateUrl: './our-story.component.html',
    styleUrl: './our-story.component.scss',
    imports: [NgOptimizedImage, AsyncPipe, MatIcon, MatFabButton, MatButton],
})
export class OurStoryComponent implements OnInit {
    /**
     * View title
     */
    protected title = 'Our Story';

    /**
     * Array containing image sources for collage
     */
    protected imageSources$?: Observable<IPhotoData[]>;

    /**
     * Denotes whether to show the collage
     */
    protected showCollage = false;

    /**
     * Array of image URLs
     */
    private readonly _imageUrls: string[] = [];

    constructor(private readonly _scrollService: ContentScrollService) {}

    ngOnInit() {
        for (let i = 1; i < 34; i++) {
            this._imageUrls.push('/images/IMG_' + i + '.webp');
        }

        this.imageSources$ = forkJoin(
            this._imageUrls.map(
                (url: string): Observable<IPhotoData> =>
                    this._getImageMetadata(url),
            ),
        ).pipe(catchError(() => of([])));
    }

    /**
     * Toggles collage view
     */
    toggleCollage(): void {
        this.showCollage = !this.showCollage;
    }

    /**
     * Scrolls to the top of the view
     */
    scrollToTop() {
        this._scrollService.scrollToTop();
    }

    /**
     * Obtains image meta-data based on image source
     * @param source The image source URL
     */
    private _getImageMetadata(source: string): Observable<IPhotoData> {
        return new Observable(observer => {
            const img = new Image();

            img.onload = () => {
                const width = img.naturalWidth;
                const height = img.naturalHeight;

                observer.next({
                    source,
                    width,
                    height,
                } as IPhotoData);
                observer.complete();
            };

            img.onerror = () => {
                observer.error(`Failed to load image: ${source}`);
            };

            img.src = source;
        });
    }
}

interface IPhotoData {
    source: string;
    width: number;
    height: number;
}
