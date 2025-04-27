import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GalleryItemDialogComponent } from './gallery-item-dialog.component';

describe('GalleryItemViewDialogComponent', () => {
    let component: GalleryItemDialogComponent;
    let fixture: ComponentFixture<GalleryItemDialogComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GalleryItemDialogComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(GalleryItemDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
