import { Component, OnInit } from '@angular/core';
import { AsyncPipe, NgClass, NgOptimizedImage } from '@angular/common';
import { catchError, forkJoin, Observable, of } from 'rxjs';

@Component({
    selector: 'app-our-story',
    templateUrl: './our-story.component.html',
    styleUrl: './our-story.component.scss',
    imports: [NgOptimizedImage, NgClass, AsyncPipe],
})
export class OurStoryComponent implements OnInit {
    /**
     * View title
     */
    protected readonly title = 'Our Story';

    /**
     * Array containing image sources
     */
    protected imageSources$?: Observable<IPhotoData[]>;

    private readonly _imageUrls: string[] = [];

    ngOnInit() {
        for (let i = 1; i < 33; i++) {
            this._imageUrls.push('/images/IMG_' + i + '.webp');
        }

        this.imageSources$ = forkJoin(
            this._imageUrls.map(
                (url: string): Observable<IPhotoData> =>
                    this._getImageMetadata(url),
            ),
        ).pipe(catchError(() => of([])));
    }

    private _determineWrapperClass(aspectRatio: number): string {
        let wrapperClass = 'story__grid-wrapper--big';

        if (aspectRatio > 1) {
            wrapperClass = 'story__grid-wrapper--big';
        } else if (aspectRatio <= 0.75) {
            wrapperClass = 'story__grid-wrapper--tall';
        }

        return wrapperClass;
    }

    private _getImageMetadata(source: string): Observable<IPhotoData> {
        return new Observable(observer => {
            const img = new Image();

            img.onload = () => {
                const width = img.naturalWidth;
                const height = img.naturalHeight;
                const aspectRatio = width / height;
                const wrapperClass = this._determineWrapperClass(aspectRatio);

                observer.next({
                    source,
                    width,
                    height,
                    aspectRatio,
                    wrapperClass,
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
    aspectRatio: number;
    wrapperClass: string;
}
