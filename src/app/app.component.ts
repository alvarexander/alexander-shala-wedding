import { AfterViewInit, Component, ViewChild } from '@angular/core';
import {
    NavigationEnd,
    Router,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
} from '@angular/router';
import {
    MatDrawer,
    MatSidenav,
    MatSidenavContainer,
    MatSidenavContent,
    MatSidenavModule,
} from '@angular/material/sidenav';
import { MatListItem, MatNavList } from '@angular/material/list';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatToolbar } from '@angular/material/toolbar';
import { filter } from 'rxjs';
import { ContentScrollService } from './components/services/content-scroll.service';

@Component({
    selector: 'app-root',
    imports: [
        RouterOutlet,
        MatSidenavContainer,
        MatNavList,
        MatSidenavModule,
        MatSidenav,
        MatListItem,
        RouterLinkActive,
        MatIcon,
        MatIcon,
        MatIconButton,
        MatToolbar,
        RouterLink,
    ],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
})
export class AppComponent implements AfterViewInit {
    /**
     * The toolbar title
     */
    toolbarTitle = 'Home';

    /**
     * The navigation drawer reference in the template
     */
    @ViewChild('sidenav') sideNav?: MatDrawer;

    /**
     * The navigation drawer content reference in the template
     */
    @ViewChild(MatSidenavContent) content!: MatSidenavContent;

    constructor(
        private readonly _router: Router,
        private readonly _scrollService: ContentScrollService,
    ) {
        this._router.events
            .pipe(filter(event => event instanceof NavigationEnd))
            .subscribe(() => this.sideNav?.close());
    }

    ngAfterViewInit() {
        this._scrollService.registerSidenavContent(this.content);
    }

    /**
     * Updates the toolbar title to reflect current active router
     * @param event The router event
     */
    updateToolbarTitle(event: any): void {
        this.toolbarTitle = event.title;
    }
}
