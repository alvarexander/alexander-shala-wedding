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
import { animate, style, transition, trigger } from '@angular/animations';

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
    animations: [
        trigger('slideScale', [
            transition(':enter', [
                style({ opacity: 0, transform: 'translateY(40px) scale(0.8)' }),
                animate(
                    '220ms ease-out',
                    style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
                ),
            ]),
            transition(':leave', [
                animate(
                    '220ms ease-in',
                    style({
                        opacity: 0,
                        transform: 'translateY(40px) scale(0.8)',
                    }),
                ),
            ]),
        ]),
    ],
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
