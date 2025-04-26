import { Injectable } from '@angular/core';
import { MatSidenavContent } from '@angular/material/sidenav';

@Injectable({ providedIn: 'root' })
export class ContentScrollService {
    /**
     * The angular material side nav content
     */
    private sidenavContent?: MatSidenavContent;

    /**
     * Registers the current angular material side nav for the view
     */
    registerSidenavContent(content: MatSidenavContent) {
        this.sidenavContent = content;
    }

    /**
     * Scrolls to the top of the mat side nav content
     */
    scrollToTop() {
        this.sidenavContent?.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
