import {
    AfterViewInit,
    Component,
    HostListener,
    ViewChild,
} from '@angular/core';
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

    /**
     * The app drawer mode
     */
    protected drawerMode: 'over' | 'side' = 'over';

    constructor(
        private readonly _router: Router,
        private readonly _scrollService: ContentScrollService,
    ) {
        this._router.events
            .pipe(filter(event => event instanceof NavigationEnd))
            .subscribe(() => {
                if (this.drawerMode === 'over') {
                    this.sideNav?.close();
                }
            });
    }

    ngAfterViewInit() {
        this._scrollService.registerSidenavContent(this.content);
        setTimeout(() => {
            this._setDrawerState(window.innerWidth);
        });
    }

    /**
     * Updates the toolbar title to reflect current active router
     * @param event The router event
     */
    updateToolbarTitle(event: any): void {
        this.toolbarTitle = event.title;
    }

    @HostListener('window:resize', ['$event'])
    onResize(event: UIEvent): void {
        const target = event.target as Window;
        this._setDrawerState(target.innerWidth);
    }

    /**
     * Utility method to set navigation drawer mode based on current window size
     * @param width The current width of the window
     */
    private _setDrawerState(width: number): void {
        this.drawerMode = width >= 992 ? 'side' : 'over';
        if (this.drawerMode === 'side' && !this.sideNav?.opened) {
            this.sideNav?.toggle();
        } else if (this.drawerMode === 'over' && this.sideNav?.opened) {
            this.sideNav?.close();
        }
    }
}
