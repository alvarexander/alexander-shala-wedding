import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { MatCard, MatCardContent } from '@angular/material/card';
import { AsyncPipe } from '@angular/common';
import { MatDivider } from '@angular/material/divider';

/**
 * Represents the time remaining until the target date.
 */
interface CountdownTime {
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
}

@Component({
    selector: 'app-countdown-timer',
    templateUrl: './countdown-timer.component.html',
    imports: [MatCardContent, MatCard, AsyncPipe, MatDivider],
    styleUrls: ['./countdown-timer.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountdownTimerComponent {
    /**
     * The target wedding date of September 26th 2026 (stored as a timestamp for faster calculations)
     */
    private readonly _targetTime = new Date('2026-09-26T00:00:00').getTime();

    /**
     * Observable emitting the remaining time every second
     */
    countdown$: Observable<CountdownTime> = timer(0, 1000).pipe(
        map(() => this._calcRemaining()),
    );

    /**
     * Calculates time remaining from now until September 26th 2026
     * @returns An object containing days, hours, minutes, and seconds as padded strings
     */
    private _calcRemaining(): CountdownTime {
        let diff = this._targetTime - Date.now();

        if (diff < 0) diff = 0;

        const msPerSecond = 1000;
        const msPerMinute = msPerSecond * 60;
        const msPerHour = msPerMinute * 60;
        const msPerDay = msPerHour * 24;

        const days = Math.floor(diff / msPerDay);
        diff -= days * msPerDay;

        const hours = Math.floor(diff / msPerHour);
        diff -= hours * msPerHour;

        const minutes = Math.floor(diff / msPerMinute);
        diff -= minutes * msPerMinute;

        const seconds = Math.floor(diff / msPerSecond);

        return {
            days: String(days),
            hours: this._pad(hours),
            minutes: this._pad(minutes),
            seconds: this._pad(seconds),
        };
    }

    /**
     * Pads the provided number
     * @param num The number to pad
     * @returns The string representation of the padded number value
     */
    private _pad(num: number): string {
        return num < 10 ? `0${num}` : String(num);
    }
}
