import { Component, Inject } from '@angular/core';
import {
    MAT_DIALOG_DATA,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogRef,
    MatDialogTitle,
} from '@angular/material/dialog';
import { IGalleryItem } from '../../../../interfaces/gallery-items.interface';
import { MatButton } from '@angular/material/button';

@Component({
    selector: 'app-gallery-item-view-dialog',
    imports: [
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatButton,
        MatDialogClose,
    ],
    templateUrl: './gallery-item-dialog.component.html',
    styleUrl: './gallery-item-dialog.component.scss',
})
export class GalleryItemDialogComponent {
    /**
     * Constructor for the gallery modal component
     *
     * @param dialogRef Reference to the dialog opened
     * @param data The data passed to the dialog, containing the gallery item
     */
    constructor(
        public dialogRef: MatDialogRef<GalleryItemDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { item: IGalleryItem },
    ) {}

    /**
     * Closes the dialog
     */
    close(): void {
        this.dialogRef.close();
    }
}
