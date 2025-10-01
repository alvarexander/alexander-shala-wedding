import { Component, Inject } from '@angular/core';
import { IGalleryItem } from '../../../interfaces/gallery-items.interface';
import { MatButton } from '@angular/material/button';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';

@Component({
    selector: 'app-gallery-item-viewer',
    imports: [MatButton],
    templateUrl: './gallery-item-viewer.component.html',
    styleUrl: './gallery-item-viewer.component.scss',
})
export class GalleryItemViewerComponent {
    /**
     * Constructor for the gallery modal component
     *
     * @param bottomSheetRef The angular bottom sheet reference
     * @param data The data passed to the sheet, containing the gallery item
     */
    constructor(
        public bottomSheetRef: MatBottomSheetRef<GalleryItemViewerComponent>,
        @Inject(MAT_BOTTOM_SHEET_DATA) public data: { item: IGalleryItem },
    ) {}

    /**
     * Closes the sheet
     */
    close(): void {
        this.bottomSheetRef.dismiss();
    }
}
