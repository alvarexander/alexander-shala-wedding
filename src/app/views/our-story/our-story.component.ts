import { Component } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Component({
    selector: 'app-our-story',
    templateUrl: './our-story.component.html',
    styleUrl: './our-story.component.scss',
})
export class OurStoryComponent {
    /**
     * View title
     */
    protected title = 'Our Story';

    constructor(private readonly _titleService: Title) {
        this._titleService.setTitle(this.title);
    }
}
