import { Component } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { CountdownTimerComponent } from '../../components/countdown-timer/countdown-timer.component';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss',
    imports: [CountdownTimerComponent],
})
export class HomeComponent {
    protected readonly title = 'Home';

    constructor(private readonly _titleService: Title) {
        this._titleService.setTitle(this.title);
    }
}
