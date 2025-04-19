import { Component, ViewChild } from '@angular/core';
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
    MatSidenavModule,
} from '@angular/material/sidenav';
import { MatListItem, MatNavList } from '@angular/material/list';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatToolbar } from '@angular/material/toolbar';
import { filter } from 'rxjs';

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
        RouterLink,
        MatIcon,
        MatIcon,
        MatIconButton,
        MatToolbar,
    ],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
})
export class AppComponent {
    /**
     * The Angular Material navigation drawer reference in the template
     */
    @ViewChild('sidenav') sideNav?: MatDrawer;

    /**
     * The title for the toolbar
     */
    toolbarTitle = 'Home';

    constructor(private readonly _router: Router) {
        this._router.events
            .pipe(filter(event => event instanceof NavigationEnd))
            .subscribe(() => this.sideNav?.close());
    }

    /**
     * Updates the toolbar title to reflect current active route
     * @param event The router event
     */
    updateToolbarTitle(event: any): void {
        this.toolbarTitle = event?.title;
    }
}
