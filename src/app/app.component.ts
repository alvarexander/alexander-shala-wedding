import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
    MatSidenav,
    MatSidenavContainer,
    MatSidenavModule,
} from '@angular/material/sidenav';
import { MatListItem, MatNavList } from '@angular/material/list';
import { NgClass } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatToolbar } from '@angular/material/toolbar';

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
        NgClass,
        MatIcon,
        MatButton,
        MatIconButton,
        MatToolbar,
    ],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
})
export class AppComponent {
    title = "Alexander & Shala's Wedding";
}
