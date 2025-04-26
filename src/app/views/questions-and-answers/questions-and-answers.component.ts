import { Component } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';

@Component({
    selector: 'app-questions-and-answers',
    imports: [MatExpansionModule],
    templateUrl: './questions-and-answers.component.html',
    styleUrl: './questions-and-answers.component.scss',
})
export class QuestionsAndAnswersComponent {
    protected readonly title = 'Questions & Answers';
}
