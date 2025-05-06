import { Component } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { Title } from '@angular/platform-browser';

@Component({
    selector: 'app-questions-and-answers',
    imports: [MatExpansionModule],
    templateUrl: './questions-and-answers.component.html',
    styleUrl: './questions-and-answers.component.scss',
})
export class QuestionsAndAnswersComponent {
    protected readonly title = 'Questions & Answers';

    constructor(private readonly _titleService: Title) {
        this._titleService.setTitle(this.title);
    }
}
