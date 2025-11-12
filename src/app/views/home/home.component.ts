import { Component } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { CountdownTimerComponent } from '../../components/countdown-timer/countdown-timer.component';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss',
    imports: [CountdownTimerComponent, MatButton, MatIcon],
})
export class HomeComponent {
    protected readonly title = 'Home';

    /**
     * Amazon registry URL
     */
    private readonly A_REGISTRY = 'https://www.amazon.com/wedding/registry/VG5SIDWDDKG1';

    constructor(private readonly _titleService: Title) {
        this._titleService.setTitle(this.title);
    }

    /**
     * Opens the link to the wedding registry
     */
    openLink(): void {
        window.open(this.A_REGISTRY, '_blank');
    }
}
