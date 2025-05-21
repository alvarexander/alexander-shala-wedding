import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GalleryItemViewerComponent } from './gallery-item-viewer.component';

describe('GalleryItemViewDialogComponent', () => {
    let component: GalleryItemViewerComponent;
    let fixture: ComponentFixture<GalleryItemViewerComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GalleryItemViewerComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(GalleryItemViewerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
